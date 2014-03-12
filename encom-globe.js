
var ENCOM = (function(ENCOM, THREE, document){

    var pixelData;

    var extend = function(first, second) {
        for(var i in first){
            second[i] = first[i];
        }
    };

    var sCurve = function(t) {
        return 1/(1 + Math.exp(-t*12 + 6));
    };

    var renderToCanvas = function (width, height, renderFunction) {
        var buffer = document.createElement('canvas');
        buffer.width = width;
        buffer.height = height;
        renderFunction(buffer.getContext('2d'));
        return buffer;
    };

    // based on http://stemkoski.github.io/Three.js/Texture-Animation.html
    var TextureAnimator = function(texture, tilesVert, tilesHoriz, numTiles, tileDispDuration, repeatAtTile) 
    {   
        var _this = this;
        // note: texture passed by reference, will be updated by the update function.

        if(repeatAtTile == undefined){
            repeatAtTile=-1;
        }

        this.shutDownFlag = (this.repeatAtTile < 0);
        this.done = false;


        this.tilesHorizontal = tilesHoriz;
        this.tilesVertical = tilesVert;

        // how many images does this spritesheet contain?
        //  usually equals tilesHoriz * tilesVert, but not necessarily,
        //  if there at blank tiles at the bottom of the spritesheet. 
        this.numberOfTiles = numTiles;
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping; 
        texture.repeat.set( 1 / this.tilesHorizontal, 1 / this.tilesVertical );

        // how long should each image be displayed?
        this.tileDisplayDuration = tileDispDuration;

        // how long has the current image been displayed?
        this.currentDisplayTime = 0;

        // which image is currently being displayed?
        this.currentTile = 0;

        texture.offset.y = 1;

        this.update = function( milliSec )
        {
            this.currentDisplayTime += milliSec;
            while (!this.done && this.currentDisplayTime > this.tileDisplayDuration)
                {
                    if(this.shutDownFlag && this.currentTile >= numTiles){
                        this.done = true;
                        this.shutDownCb();
                    } else {
                        this.currentDisplayTime -= this.tileDisplayDuration;
                        this.currentTile++;
                        if (this.currentTile == numTiles && !this.shutDownFlag)
                            this.currentTile = repeatAtTile;
                        var currentColumn = this.currentTile % this.tilesHorizontal;
                        texture.offset.x = currentColumn / this.tilesHorizontal;
                        var currentRow = Math.floor( this.currentTile / this.tilesHorizontal );
                        texture.offset.y = 1-(currentRow / this.tilesVertical) - 1/this.tilesVertical;
                    }
                }
        };
        this.shutDown = function(cb){
            _this.shutDownFlag = true;
            _this.shutDownCb = cb;
        }

    };

    /* private globe function */

    var latLonToXY = function(width, height, lat,lon){

        var x = Math.floor(width/2.0 + (width/360.0)*lon);
        var y = Math.floor(height - (height/2.0 + (height/180.0)*lat));

        return {x: x, y:y};
    };

    var samplePoints = function(projectionContext, width, height, latoffset, lonoffset, latinc, loninc, cb){
        var points = [],
        isPixelBlack = function(context, x, y, width, height){
            if(pixelData == undefined){
                pixelData = context.getImageData(0,0,width, height);
            }
            return pixelData.data[(y * pixelData.width + x) * 4] === 0;
        };

        for(var lat = 90-latoffset; lat > -90; lat -= latinc){
            for(var lon = -180+lonoffset; lon < 180; lon += loninc){
                var point = latLonToXY(width, height, lat, lon);
                if(isPixelBlack(projectionContext,point.x, point.y, width, height)){
                    // if(Math.random() < .01){
                    //     console.log("{lat: " + lat + ",lng:" + lon + ",label:\"\"},");
                    // }
                    cb({lat: lat, lon: lon});
                    points.push({lat: lat, lon: lon});
                }
            }
        }
        return points;
    };

    var mapPoint = function(lat, lng, scale) {
        if(!scale){
            scale = 500;
        }
        var phi = (90 - lat) * Math.PI / 180;
        var theta = (180 - lng) * Math.PI / 180;
        var x = scale * Math.sin(phi) * Math.cos(theta);
        var y = scale * Math.cos(phi);
        var z = scale * Math.sin(phi) * Math.sin(theta);
        return {x: x, y: y, z:z};
    }

    var addPointAnimation = function(when, verticleIndex, position){
        var pCount = this.globe_pointAnimations.length-1;
        while(pCount > 0 && this.globe_pointAnimations[pCount].when < when){
            pCount--;
        }
        this.globe_pointAnimations.splice(pCount+1,0, {when: when, verticleIndex: verticleIndex, position: position});
    };

    var runPointAnimations = function(){
        var next;
        if(!this.firstRunTime){
            this.firstRunTime = Date.now();
        }

        if(this.globe_pointAnimations.length == 0){
            return;
        }

        while(this.globe_pointAnimations.length > 0 && this.firstRunTime + (next = this.globe_pointAnimations.pop()).when < Date.now()){
            this.globe_particles.geometry.vertices[next.verticleIndex].x = next.position.x;
            this.globe_particles.geometry.vertices[next.verticleIndex].y = next.position.y;
            this.globe_particles.geometry.vertices[next.verticleIndex].z = next.position.z;

            this.globe_particles.geometry.verticesNeedUpdate = true;
        }
        if(this.firstRunTime + next.when >= Date.now()){
            this.globe_pointAnimations.push(next);
        }

    };

    var addInitialData = function(){
        if(this.data.length == 0){
            return;
        }
        while(this.data.length > 0 && this.firstRunTime + (next = this.data.pop()).when < Date.now()){
            this.addMarker(next.lat, next.lng, next.label);
        }

        if(this.firstRunTime + next.when >= Date.now()){
            this.data.push(next);
        }
    };

    var createLabel = function(text, x, y, z, size, color, underlineColor) {

        var canvas = document.createElement("canvas");
        var context = canvas.getContext("2d");
        context.font = size + "pt Inconsolata";

        var textWidth = context.measureText(text).width;

        canvas.width = textWidth;
        canvas.height = size + 10;


        // better if canvases have even heights
        if(canvas.width % 2){
            canvas.width++;
        }
        if(canvas.height % 2){
            canvas.height++;
        }

        if(underlineColor){
            canvas.height += 30;
        }
        context.font = size + "pt Inconsolata";

        context.textAlign = "center";
        context.textBaseline = "middle";

        context.strokeStyle = 'black';

        context.miterLimit = 2;
        context.lineJoin = 'circle';
        context.lineWidth = 6;

        context.strokeText(text, canvas.width / 2, canvas.height / 2);

        context.lineWidth = 2;

        context.fillStyle = color;
        context.fillText(text, canvas.width / 2, canvas.height / 2);

        if(underlineColor){
            context.strokeStyle=underlineColor;
            context.lineWidth=4;
            context.beginPath();
            context.moveTo(0, canvas.height-10);
            context.lineTo(canvas.width-1, canvas.height-10);
            context.stroke();
        }

        var texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;

        var material = new THREE.SpriteMaterial({
            map : texture,
            useScreenCoordinates: false,
            opacity:0,
            depthTest: false,
            fog: true

        });

        var sprite = new THREE.Sprite(material);
        sprite.position = {x: x*1.1, y: y + (y < 0 ? -15 : 30), z: z*1.1};
        sprite.scale.set(canvas.width, canvas.height);
        new TWEEN.Tween( {opacity: 0})
        .to( {opacity: 1}, 500 )
        .onUpdate(function(){
            material.opacity = this.opacity
        }).delay(1000)
        .start();

        return sprite;

    }

    var createSatelliteCanvas = function(numFrames, pixels, rows, waveStart, numWaves) {

        var cols = numFrames / rows;
        var waveInterval = Math.floor((numFrames-waveStart)/numWaves);
        var waveDist = pixels - 25; // width - center of satellite
        var distPerFrame = waveDist / (numFrames-waveStart)
        var offsetx = 0,
        offsety = 0;
        var curRow = 0;

        return renderToCanvas(numFrames * pixels / rows, pixels * rows, function(ctx){

            for(var i = 0; i< numFrames; i++){
                if(i - curRow * cols >= cols){
                    offsetx = 0;
                    offsety += pixels;
                    curRow++;
                }

                var centerx = offsetx + 25;
                var centery = offsety + Math.floor(pixels/2);

                /* white circle around red core */
                // i have between 0 and wavestart to fade in
                // i have between wavestart and  waveend - (time between waves*2) 
                // to do a full spin close and then back open
                // i have between waveend-2*(timebetween waves)/2 and waveend to rotate Math.PI/4 degrees
                // this is probably the ugliest code in all of here -- basically I just messed arund with stuff until it looked ok

                ctx.lineWidth=2;
                ctx.strokeStyle="#FFFFFF";
                var buffer=Math.PI/16;
                var start = -Math.PI + Math.PI/4;
                var radius = 8;
                var repeatAt = Math.floor(numFrames-2*(numFrames-waveStart)/numWaves)+1;

                /* fade in and out */
                if(i<waveStart){
                    radius = radius*i/waveStart;
                }

                var swirlDone = Math.floor((repeatAt-waveStart) / 2) + waveStart;

                for(var n = 0; n < 4; n++){
                    ctx.beginPath();

                    if(i < waveStart || i>=numFrames){

                        ctx.arc(centerx, centery, radius,n* Math.PI/2 + start+buffer, n*Math.PI/2 + start+Math.PI/2-2*buffer);

                    } else if(i > waveStart && i < swirlDone){
                        var totalTimeToComplete = swirlDone - waveStart;
                        var distToGo = 3*Math.PI/2;
                        var currentStep = (i-waveStart);
                        var movementPerStep = distToGo / totalTimeToComplete;

                        var startAngle = -Math.PI + Math.PI/4 + buffer + movementPerStep*currentStep;

                        ctx.arc(centerx, centery, radius,Math.max(n*Math.PI/2 + start,startAngle), Math.max(n*Math.PI/2 + start + Math.PI/2 - 2*buffer, startAngle +Math.PI/2 - 2*buffer));

                    } else if(i >= swirlDone && i< repeatAt){
                        var totalTimeToComplete = repeatAt - swirlDone;
                        var distToGo = n*2*Math.PI/4;
                        var currentStep = (i-swirlDone);
                        var movementPerStep = distToGo / totalTimeToComplete;


                        var startAngle = Math.PI/2 + Math.PI/4 + buffer + movementPerStep*currentStep;
                        ctx.arc(centerx, centery, radius,startAngle, startAngle + Math.PI/2 - 2*buffer);

                    } else if(i >= repeatAt && i < (numFrames-repeatAt)/2 + repeatAt){

                        var totalTimeToComplete = (numFrames-repeatAt)/2;
                        var distToGo = Math.PI/2;
                        var currentStep = (i-repeatAt);
                        var movementPerStep = distToGo / totalTimeToComplete;
                        var startAngle = n*(Math.PI/2)+ Math.PI/4 + buffer + movementPerStep*currentStep;

                        ctx.arc(centerx, centery, radius,startAngle, startAngle + Math.PI/2 - 2*buffer);

                    } else{
                        ctx.arc(centerx, centery, radius,n* Math.PI/2 + start+buffer, n*Math.PI/2 + start+Math.PI/2-2*buffer);
                    }
                    ctx.stroke();
                }

                // frame i'm on * distance per frame

                /* waves going out */
                var frameOn;

                for(var wi = 0; wi<numWaves; wi++){
                    frameOn = i-(waveInterval*wi)-waveStart;
                    if(frameOn > 0 && frameOn * distPerFrame < pixels - 25){
                        ctx.strokeStyle="rgba(255,255,255," + (.9-frameOn*distPerFrame/(pixels-25)) + ")";
                        ctx.lineWidth=2;
                        ctx.beginPath();
                        ctx.arc(centerx, centery, frameOn * distPerFrame, -Math.PI/12, Math.PI/12);
                        ctx.stroke();
                    }
                }
                /* red circle in middle */

                ctx.fillStyle="#000";
                ctx.beginPath();
                ctx.arc(centerx,centery,3,0,2*Math.PI);
                ctx.fill();

                ctx.strokeStyle="#FF0000";
                ctx.lineWidth=2;
                ctx.beginPath();
                if(i<waveStart){
                    ctx.arc(centerx,centery,3*i/waveStart,0,2*Math.PI);
                } else {
                    ctx.arc(centerx,centery,3,0,2*Math.PI);
                }
                ctx.stroke();

                offsetx += pixels;
            }

        });

    };

    var createSpecialMarkerCanvas = function() {
        var markerWidth = 100,
        markerHeight = 100;

        return renderToCanvas(markerWidth, markerHeight, function(ctx){
            ctx.strokeStyle="#FFCC00";
            ctx.lineWidth=3;
            ctx.beginPath();
            ctx.arc(markerWidth/2, markerHeight/2, markerWidth/3+10, 0, 2* Math.PI);
            ctx.stroke();

            ctx.fillStyle="#FFCC00";
            ctx.beginPath();
            ctx.arc(markerWidth/2, markerHeight/2, markerWidth/4, 0, 2* Math.PI);
            ctx.fill();

        });

    }

    var mainParticles = function(){

        var material, geometry;

        var colors = [];

        var sprite = this.hexTexture;
        var myColors1 = pusher.color('#ffcc00').hueSet();
        var myColors = [];
        for(var i = 0; i< myColors1.length; i++){
            myColors.push(myColors1[i]);

            // myColors.push(myColors1[i].shade(.2 + Math.random()/2.0));
            // myColors.push(myColors1[i].shade(.2 + Math.random()/2.0));
        }
        var geometry = new THREE.Geometry();

        for ( i = 0; i < this.points.length; i ++ ) {


            var vertex = new THREE.Vector3();
            var point = mapPoint(this.points[i].lat, this.points[i].lon, 500);
            var delay = this.swirlTime*((180+this.points[i].lon)/360.0); 

            vertex.x = 0;
            vertex.y = 0;
            vertex.z = this.cameraDistance+1;

            geometry.vertices.push( vertex );

            addPointAnimation.call(this,delay, i, {
                x : point.x*this.swirlMultiplier,
                y : point.y*this.swirlMultiplier,
                z : point.z*this.swirlMultiplier});

                for(var a = 0; a < 4; a++){
                    addPointAnimation.call(this,delay + 500 + (60)*a, i, {
                        x : point.x*(this.swirlMultiplier - (.1 + a/40.0)),
                        y : point.y*(this.swirlMultiplier - (.1 + a/40.0)),
                        z : point.z*(this.swirlMultiplier - (.1 + a/40.0))});
                }

                addPointAnimation.call(this,delay + 690, i, {
                    x : point.x,
                    y : point.y,
                    z : point.z});

                    colors[i] = new THREE.Color( myColors[Math.floor(Math.random() * myColors.length)].hex6());

        }

        geometry.colors = colors;

        material = new THREE.ParticleSystemMaterial( { size: 13, map: sprite, vertexColors: true, transparent: false} );

        this.globe_particles = new THREE.ParticleSystem( geometry, material );

        this.scene.add( this.globe_particles );

    };

    var swirls = function(){
        var geometrySpline;
        var sPoint;
        var _this = this;

        this.swirlMaterial = new THREE.LineBasicMaterial({
            color: 0x8FD8D8,
            transparent: true,
            linewidth: 2,
            opacity: .8
        });

        for(var i = 0; i<75; i++){
            geometrySpline = new THREE.Geometry();

            var lat = Math.random()*180 + 90;
            var lon =  Math.random()*5;
            var lenBase = 4 + Math.floor(Math.random()*5);

            if(Math.random()<.3){
                lon = Math.random()*30 - 50;
                lenBase = 3 + Math.floor(Math.random()*3);
            }

            for(var j = 0; j< lenBase; j++){
                var thisPoint = mapPoint(lat, lon - j * 5);
                sPoint = new THREE.Vector3(thisPoint.x*this.swirlMultiplier, thisPoint.y*this.swirlMultiplier, thisPoint.z*this.swirlMultiplier);

                geometrySpline.vertices.push(sPoint);  
            }

            this.swirl.add(new THREE.Line(geometrySpline, this.swirlMaterial));

        }
        this.scene.add(this.swirl);
    };

    var removeMarker = function(marker){

        var pos = marker.line.geometry.vertices[1];
        var _this = this;
        var scaleDownBy = 1+ Math.random()*.2;

        if(!marker.active){
            return;
        }

        marker.active = false;

        for(var i = marker.startSmokeIndex; i< marker.smokeCount + marker.startSmokeIndex; i++){
            var realI = i % _this.smokeAttributes.active.value.length;
            _this.smokeAttributes.active.value[realI] = 0.0;
            _this.smokeAttributes.active.needsUpdate = true;
        }

        new TWEEN.Tween({posx: pos.x, posy: pos.y, posz: pos.z, opacity: 1})
        .to( {posx: pos.x/scaleDownBy, posy: pos.y/scaleDownBy, posz: pos.z/scaleDownBy, opacity: 0}, 1000 )
        .onUpdate(function(){

            marker.line.geometry.vertices[1].set(this.posx, this.posy, this.posz);
            marker.line.geometry.verticesNeedUpdate = true;
            marker.label.material.opacity = this.opacity;
            marker.top.material.opacity = this.opacity;
            marker.top.position.set(this.posx, this.posy, this.posz);
        })
        .onComplete(function(){
            _this.scene.remove(marker.label);
            _this.scene.remove(marker.top);
        })
        .start();

        this.quills.push({
            line: marker.line,
            latlng: marker.latlng
        });

        if(this.quills.length > this.maxQuills){
            removeQuill.call(this, this.quills.shift());
        }


    };

    var removeQuill = function(quill){

        var pos = quill.line.geometry.vertices[1];
        var pos2 = quill.line.geometry.vertices[0];
        var _this = this;
        var scaleDownBy = 1+ Math.random()*.2;

        delete this.markerIndex[quill.latlng];

        new TWEEN.Tween({posx: pos.x, posy: pos.y, posz: pos.z, opacity: 1})
        .to( {posx: pos2.x, posy: pos2.y, posz: pos2.z}, 1000 )
        .onUpdate(function(){
            quill.line.geometry.vertices[1].set(this.posx, this.posy, this.posz);
            quill.line.geometry.verticesNeedUpdate = true;
        })
        .onComplete(function(){
            _this.scene.remove(quill.line);
        })
        .start();

    };

    var updateSatellites = function(renderTime){
        for(var i = 0; i< this.satelliteAnimations.length; i++){
            this.satelliteAnimations[i].update(renderTime);
        }
    };

    var registerMarker = function(marker, lat, lng){
        var labelKey = Math.floor(lat/20) + '-' + Math.floor(lng/40);
        if(Math.abs(lat)>80){
            labelKey = Math.floor(lat/20);
        }
        this.markerCoords[labelKey] = marker;

    };

    var findNearbyMarkers = function(lat, lng){
        var ret = [];
        var labelKey = Math.floor(lat/20) + '-' + Math.floor(lng/40);
        if(Math.abs(lat)>80){
            labelKey = Math.floor(lat/20);
        }

        if(this.markerCoords[labelKey]){
            ret.push(this.markerCoords[labelKey]);
        }

        return ret;

    };

    /* globe constructor */

    function Globe(opts){

        if(!opts){
            opts = {};
        }

        var baseSampleMultiplier = .85;

        var defaults = {
            width: document.width,
            height: document.height,
            font: "Inconsolata",
            mapUrl: "resources/equirectangle_projection.png",
            size: 100,
            swirlMultiplier: 1.15,
            swirlTime: 2500,
            cameraDistance: 1700,
            samples: [
                { 
                offsetLat: 0,
                offsetLon: 0,
                incLat: baseSampleMultiplier * 2,
                incLon: baseSampleMultiplier * 4
            },
            { 
                offsetLat: baseSampleMultiplier,
                offsetLon: baseSampleMultiplier * 2,
                incLat: baseSampleMultiplier * 2,
                incLon: baseSampleMultiplier * 4
            }
            ],
            points: [],
            globe_pointAnimations: [],
            swirl: new THREE.Object3D(),
            markers: [],
            quills: [],
            markerCoords: {},
            maxMarkers: 20,
            maxQuills:100,
            markerIndex: {},
            satelliteAnimations: [],
            satelliteMeshes: [],
            data: []

        };


        this.smokeIndex = 0;

        extend(opts, defaults);

        for(var i in defaults){
            if(!this[i]){
                this[i] = defaults[i];
            }
        }

        this.renderer = new THREE.WebGLRenderer( { antialias: true } );
        this.renderer.setSize( this.width, this.height);

        this.domElement = this.renderer.domElement;

        this.data.sort(function(a,b){return (b.lng - b.label.length * 2) - (a.lng - a.label.length * 2)});

        for(var i = 0; i< this.data.length; i++){
            console.log(this.data[i]);
            var delay = this.swirlTime*((180+this.data[i].lng)/360.0); 
            this.data[i].when = delay + 100;
        }

    }

    /* public globe functions */

    Globe.prototype.init = function(cb){
        var  projectionContext,
            img = document.createElement('img'),
            projectionCanvas = document.createElement('canvas'),
            _this = this;

        document.body.appendChild(projectionCanvas);
        projectionContext = projectionCanvas.getContext('2d');

        var numRegistered = 0;

        var registerCallback = function(){
            numRegistered++;
            return function(){

                numRegistered--;

                if(numRegistered == 0){
                    //image has loaded, may rsume
                    projectionCanvas.width = img.width;
                    projectionCanvas.height = img.height;
                    projectionContext.drawImage(img, 0, 0, img.width, img.height);
                    for (var i = 0; i< _this.samples.length; i++){

                        samplePoints(projectionContext,img.width, img.height, _this.samples[i].offsetLat, _this.samples[i].offsetLon, _this.samples[i].incLat, _this.samples[i].incLon, function(point){
                            if((point.lat > -60 || Math.random() > .9) && Math.random()>.2){ // thin it out (especially antartica)
                                _this.points.push(point);
                            }
                        });
                    }
                    document.body.removeChild(projectionCanvas);


                    // create the camera

                    _this.camera = new THREE.PerspectiveCamera( 50, _this.width / _this.height, 1, _this.cameraDistance + 275 );
                    _this.camera.position.z = _this.cameraDistance;

                    _this.cameraAngle=(Math.PI * 2) * .5;

                    // create the scene

                    _this.scene = new THREE.Scene();

                    _this.scene.fog = new THREE.Fog( 0x000000, _this.cameraDistance-200, _this.cameraDistance+275 );

                    // add the globe particles
                    mainParticles.call(_this);

                    // add the swirls
                    swirls.call(_this);

                    // pregenerate the satellite canvas
                    var numFrames = 50;
                    var pixels = 100;
                    var rows = 10;
                    var waveStart = Math.floor(numFrames/8);
                    var numWaves = 8;
                    var repeatAt = Math.floor(numFrames-2*(numFrames-waveStart)/numWaves)+1;
                    _this.satelliteCanvas = createSatelliteCanvas.call(this, numFrames, pixels, rows, waveStart, numWaves);

                    // initialize the smoke
                    // create particle system
                    _this.smokeParticleGeometry = new THREE.Geometry();

                    _this.smokeVertexShader = [
                        "#define PI 3.141592653589793238462643",
                        "#define DISTANCE 600.0",
                        "attribute float myStartTime;",
                        "attribute float myStartLat;",
                        "attribute float myStartLon;",
                        "attribute float active;",
                        "uniform float currentTime;",
                        "uniform vec3 color;",
                        "varying vec4 vColor;",
                        "",
                        "vec3 getPos(float lat, float lon)",
                        "{",
                        "if (lon < -180.0){",
                        "   lon = 180.0;",
                        "}",
                        "float phi = (90.0 - lat) * PI / 180.0;",
                        "float theta = (180.0 - lon) * PI / 180.0;",
                        "float x = DISTANCE * sin(phi) * cos(theta);",
                        "float y = DISTANCE * cos(phi);",
                        "float z = DISTANCE * sin(phi) * sin(theta);",
                        "return vec3(x, y, z);",
                        "}",
                        "",
                        "void main()",
                        "{",
                        "float dt = currentTime - myStartTime;",
                        "if (dt < 0.0){",
                        "dt = 0.0;",
                        "}",
                        "if (dt > 0.0 && active > 0.0) {",
                        "dt = mod(dt,1500.0);",
                        "}",
                        "float opacity = 1.0 - dt/ 1500.0;",
                        "if (dt == 0.0 || active == 0.0){",
                        "opacity = 0.0;",
                        "}",
                        "float cameraAngle = (2.0 * PI) / (20000.0/currentTime);",
                        "float myAngle = (180.0-myStartLon) * PI / 180.0;",
                        "opacity = opacity * (cos(myAngle - cameraAngle - PI) + 1.0)/2.0;",
                        "float newPosRaw = myStartLon - (dt / 50.0);",
                        "vec3 newPos = getPos(myStartLat, myStartLon - ( dt / 50.0));",
                        "vColor = vec4( color, opacity );", //     set color associated to vertex; use later in fragment shader.
                        "vec4 mvPosition = modelViewMatrix * vec4( newPos, 1.0 );",
                        "gl_PointSize = 2.5 - (dt / 1500.0);",
                        "gl_Position = projectionMatrix * mvPosition;",
                        "}"
                    ].join("\n");

                    _this.smokeFragmentShader = [
                        "varying vec4 vColor;",     
                        "void main()", 
                        "{",
                        "gl_FragColor = vColor;",
                        "}"
                    ].join("\n");

                    _this.smokeAttributes = {
                        myStartTime: {type: 'f', value: []},
                        myStartLat: {type: 'f', value: []},
                        myStartLon: {type: 'f', value: []},
                        active: {type: 'f', value: []}
                    };

                    _this.smokeUniforms = {
                        currentTime: { type: 'f', value: 0.0},
                        color: { type: 'c', value: new THREE.Color("#aaa")},
                    }

                    _this.smokeMaterial = new THREE.ShaderMaterial( {
                        uniforms:       _this.smokeUniforms,
                        attributes:     _this.smokeAttributes,
                        vertexShader:   _this.smokeVertexShader,
                        fragmentShader: _this.smokeFragmentShader,
                        transparent:    true
                    });

                    for(var i = 0; i< 2000; i++){
                        var vertex = new THREE.Vector3();
                        vertex.set(0,0,_this.cameraDistance+1);
                        _this.smokeParticleGeometry.vertices.push( vertex );
                        _this.smokeAttributes.myStartTime.value[i] = 0.0;
                        _this.smokeAttributes.myStartLat.value[i] = 0.0;
                        _this.smokeAttributes.myStartLon.value[i] = 0.0;
                        _this.smokeAttributes.active.value[i] = 0.0;
                    }
                    _this.smokeAttributes.myStartTime.needsUpdate = true;
                    _this.smokeAttributes.myStartLat.needsUpdate = true;
                    _this.smokeAttributes.myStartLon.needsUpdate = true;
                    _this.smokeAttributes.active.needsUpdate = true;

                    var particleSystem = new THREE.ParticleSystem( _this.smokeParticleGeometry, _this.smokeMaterial);

                    _this.scene.add( particleSystem);

                    cb();
                }

            }
        };

        this.markerTopTexture = new THREE.ImageUtils.loadTexture( 'resources/markertop.png', undefined, registerCallback());
        this.hexTexture = THREE.ImageUtils.loadTexture( "resources/hex.png", undefined, registerCallback());

        this.specialMarkerTexture = new THREE.Texture(createSpecialMarkerCanvas.call(this));
        this.specialMarkerTexture.needsUpdate = true;

        img.addEventListener('load', registerCallback());

        img.src = this.mapUrl;
    };

    Globe.prototype.addMarker = function(lat, lng, text){

        var _this = this;
        var point = mapPoint(lat,lng);


        /* check to see if we have somebody at that exact lat-lng right now */

        var checkExisting = this.markerIndex[lat + "-" + lng];
        if(checkExisting){
            return false;
        }

        // always make at least a line for the quill
        //
        /* add line */
        var markerGeometry = new THREE.Geometry();
        var markerMaterial = new THREE.LineBasicMaterial({
            color: 0x8FD8D8,
        });
        markerGeometry.vertices.push(new THREE.Vector3(point.x, point.y, point.z));
        markerGeometry.vertices.push(new THREE.Vector3(point.x, point.y, point.z));
        var line = new THREE.Line(markerGeometry, markerMaterial);
        this.scene.add(line);

        line._globe_multiplier = 1.2; // if normal line, make it 1.2 times the radius in orbit

        var existingMarkers = findNearbyMarkers.call(_this, lat, lng);
        var allOld = true;
        for(var i = 0; i< existingMarkers.length; i++){
            if(Date.now() - existingMarkers[i].creationDate < 10000){
                allOld = false;
            }
        }
        this.markerIndex[lat + "-" + lng] = true;

        if(existingMarkers.length == 0 || allOld){
            // get rid of old ones

            for(var i = 0; i< existingMarkers.length; i++){
                removeMarker.call(this, existingMarkers[i]);
            }

            // create the new one

            /* add the text */
            var textSprite = createLabel(text, point.x*1.18, point.y*1.18, point.z*1.18, 18, "white");
            this.scene.add(textSprite);

            /* add the top */
            var markerTopMaterial = new THREE.SpriteMaterial({map: _this.markerTopTexture, color: 0xFD7D8, depthTest: false, fog: true, opacity: text.length > 0});
            var markerTopSprite = new THREE.Sprite(markerTopMaterial);
            markerTopSprite.scale.set(15, 15);
            markerTopSprite.position.set(point.x*1.2, point.y*1.2, point.z*1.2);


            /* add the smoke */
            var startSmokeIndex = _this.smokeIndex;

            for(var i = 0; i< 30; i++){
                _this.smokeParticleGeometry.vertices[_this.smokeIndex].set(point.x * 1.2, point.y * 1.2, point.z * 1.2);
                _this.smokeParticleGeometry.verticesNeedUpdate = true;
                _this.smokeAttributes.myStartTime.value[_this.smokeIndex] = _this.totalRunTime + (i*50 + 1500);
                _this.smokeAttributes.myStartLat.value[_this.smokeIndex] = lat;
                _this.smokeAttributes.myStartLon.value[_this.smokeIndex] = lng;
                _this.smokeAttributes.active.value[_this.smokeIndex] = (text.length > 0 ? 1.0 : 0.0);
                _this.smokeAttributes.myStartTime.needsUpdate = true;
                _this.smokeAttributes.myStartLat.needsUpdate = true;
                _this.smokeAttributes.myStartLon.needsUpdate = true;
                _this.smokeAttributes.active.needsUpdate = true;

                _this.smokeIndex++;
                _this.smokeIndex = _this.smokeIndex % _this.smokeParticleGeometry.vertices.length;
            }

            var m = {
                line: line,
                label: textSprite,
                top: markerTopSprite,
                startSmokeIndex: startSmokeIndex,
                smokeCount: 30,
                active: true,
                creationDate: Date.now(),
                latlng: lat + "-" + lng
            };

            this.markers.push(m);

            registerMarker.call(_this,m, lat, lng);

            setTimeout(function(){
                _this.scene.add(markerTopSprite);
            }, 1500)

        } else {
            line._globe_multiplier = 1 + (.05 + Math.random() * .15); // randomize how far out
            this.quills.push({
                line: line,
                latlng: lat + "-" + lng
            });


            if(this.quills.length > this.maxQuills){
                removeQuill.call(this, this.quills.shift());
            }
        }

        new TWEEN.Tween(point)
        .to( {x: point.x*line._globe_multiplier, y: point.y*line._globe_multiplier, z: point.z*line._globe_multiplier}, 1500 )
        .easing( TWEEN.Easing.Elastic.InOut )
        .onUpdate(function(){
            markerGeometry.vertices[1].x = this.x;
            markerGeometry.vertices[1].y = this.y;
            markerGeometry.vertices[1].z = this.z;
            markerGeometry.verticesNeedUpdate = true;
        })
        .start();




    }

    Globe.prototype.addConnectedPoints = function(lat1, lng1, text1, lat2, lng2, text2){

        var _this = this;

        var point1 = mapPoint(lat1,lng1);
        var point2 = mapPoint(lat2,lng2);

        var markerMaterial = new THREE.SpriteMaterial({map: _this.specialMarkerTexture, opacity: .7, depthTest: false, fog: true});
        // var markerMaterial = new THREE.SpriteMaterial({map: _this.markerTopTexture});

        var marker1 = new THREE.Sprite(markerMaterial);
        var marker2 = new THREE.Sprite(markerMaterial);

        marker1.scale.set(0, 0);
        marker2.scale.set(0, 0);

        marker1.position.set(point1.x*1.2, point1.y*1.2, point1.z*1.2);
        marker2.position.set(point2.x*1.2, point2.y*1.2, point2.z*1.2);

        this.scene.add(marker1);
        this.scene.add(marker2);

        var textSprite1 = createLabel(text1.toUpperCase(), point1.x*1.25, point1.y*1.25, point1.z*1.25, 25, "white", "#FFCC00");
        var textSprite2 = createLabel(text2.toUpperCase(), point2.x*1.25, point2.y*1.25, point2.z*1.25, 25, "white", "#FFCC00");

        this.scene.add(textSprite1);
        this.scene.add(textSprite2);

        new TWEEN.Tween({x: 0, y: 0})
        .to({x: 50, y: 50}, 2000)
        .easing( TWEEN.Easing.Elastic.InOut )
        .onUpdate(function(){
            marker1.scale.set(this.x, this.y);
        })
        .start();

        new TWEEN.Tween({x: 0, y: 0})
        .to({x: 45, y: 45}, 2000)
        .easing( TWEEN.Easing.Elastic.InOut )
        .onUpdate(function(){
            marker2.scale.set(this.x, this.y);
        })
        .delay(2200)
        .start();

        var geometrySpline = new THREE.Geometry();
        var materialSpline = new THREE.LineBasicMaterial({
            color: 0xFFCC00,
            transparent: true,
            linewidth: 2,
            opacity: .5
        });

        var geometrySpline2 = new THREE.Geometry();
        var materialSpline2 = new THREE.LineBasicMaterial({
            color: 0xFFCC00,
            linewidth: 1,
            transparent: true,
            opacity: .5
        });

        var latdist = (lat2 - lat1)/99;
        var londist = (lng2 - lng1)/99;
        var startPoint = mapPoint(lat1, lng1);
        var pointList = [];
        var pointList2 = [];

        for(var j = 0; j< 100; j++){
            // var nextlat = ((90 + lat1 + j*1)%180)-90;
            // var nextlon = ((180 + lng1 + j*1)%360)-180;


            var nextlat = (((90 + lat1 + j*latdist)%180)-90) * (.5 + Math.cos(j*(5*Math.PI/2)/99)/2) + (j*lat2/99/2);
            var nextlon = ((180 + lng1 + j*londist)%360)-180;
            pointList.push({lat: nextlat, lon: nextlon, index: j});
            if(j == 0 || j == 99){
                pointList2.push({lat: nextlat, lon: nextlon, index: j});
            } else {
                pointList2.push({lat: nextlat+1, lon: nextlon, index: j});
            }
            // var thisPoint = mapPoint(nextlat, nextlon);
            sPoint = new THREE.Vector3(startPoint.x*1.2, startPoint.y*1.2, startPoint.z*1.2);
            sPoint2 = new THREE.Vector3(startPoint.x*1.2, startPoint.y*1.2, startPoint.z*1.2);
            // sPoint = new THREE.Vector3(thisPoint.x*1.2, thisPoint.y*1.2, thisPoint.z*1.2);

            sPoint.globe_index = j;
            sPoint2.globe_index = j;

            geometrySpline.vertices.push(sPoint);  
            geometrySpline2.vertices.push(sPoint2);  
        }

        var currentLat = lat1;
        var currentLon = lng1;
        var currentPoint;
        var currentVert;

        var update = function(){
            var nextSpot = pointList.shift();
            var nextSpot2 = pointList2.shift();

            for(var x = 0; x< geometrySpline.vertices.length; x++){

                currentVert = geometrySpline.vertices[x];
                currentPoint = mapPoint(nextSpot.lat, nextSpot.lon);

                currentVert2 = geometrySpline2.vertices[x];
                currentPoint2 = mapPoint(nextSpot2.lat, nextSpot2.lon);


                if(x >= nextSpot.index){
                    currentVert.set(currentPoint.x*1.2, currentPoint.y*1.2, currentPoint.z*1.2);
                    currentVert2.set(currentPoint2.x*1.19, currentPoint2.y*1.19, currentPoint2.z*1.19);
                }
                geometrySpline.verticesNeedUpdate = true;
                geometrySpline2.verticesNeedUpdate = true;
            }
            if(pointList.length > 0){
                setTimeout(update,30);
            }

        };
        setTimeout(function(){
            update();
        }, 2000);

        this.scene.add(new THREE.Line(geometrySpline, materialSpline));
        this.scene.add(new THREE.Line(geometrySpline2, materialSpline2, THREE.LinePieces));

    }


    Globe.prototype.addSatellite = function(lat, lon, dist, newTexture){

        var point = mapPoint(lat,lon);
        point.x *= dist;
        point.y *= dist;
        point.z *= dist;

        var numFrames = 50;
        var pixels = 100;
        var rows = 10;
        var waveStart = Math.floor(numFrames/8);
        var numWaves = 8;
        var repeatAt = Math.floor(numFrames-2*(numFrames-waveStart)/numWaves)+1;

        if(newTexture || !this.satelliteTexture){
            this.satelliteTexture = new THREE.Texture(this.satelliteCanvas)
            this.satelliteTexture.needsUpdate = true;
            var animator = new TextureAnimator(this.satelliteTexture,rows, numFrames/rows, numFrames, 80, repeatAt); 
            this.satelliteAnimations.push(animator);
        }

        var material = new THREE.MeshBasicMaterial({
            map : this.satelliteTexture,
            transparent: true
        });

        var geo = new THREE.PlaneGeometry(150,150,1,1);
        var mesh = new THREE.Mesh(geo, material);

        mesh.tiltMultiplier = Math.PI/2 * (1 - Math.abs(lat / 90));
        mesh.tiltDirection = (lat > 0 ? -1 : 1);
        mesh.lon = lon;

        this.satelliteMeshes.push(mesh);

        mesh.position.set(point.x, point.y, point.z);

        mesh.rotation.z = -1*(lat/90)* Math.PI/2;
        mesh.rotation.y = (lon/180)* Math.PI
        this.scene.add(mesh);
        return {mesh: mesh, shutDownFunc: (animator ? animator.shutDown : function(){})};

    };

    Globe.prototype.removeSatellite = function(sat){
        var _this = this;


        function kill(){
            var pos = -1;
            for(var i = 0; i < _this.satelliteMeshes.length; i++){
                if(sat.mesh == _this.satelliteMeshes[i]){
                    pos = i;
                }
            }

            // cannot remove the first one
            if(pos >= 0){
                _this.scene.remove(sat.mesh);
                _this.satelliteMeshes.splice(pos,1);
            }
        }

        // don't shut down the first one
        if(this.satelliteAnimations.length > 1){
            sat.shutDownFunc(kill);

        } else {
            kill();
        }


    };


    Globe.prototype.tick = function(){
        runPointAnimations.call(this);
        addInitialData.call(this);
        TWEEN.update();

        if(!this.lastRenderDate){
            this.lastRenderDate = new Date();
        }

        if(!this.firstRenderDate){
            this.firstRenderDate = new Date();
        }

        this.totalRunTime = new Date() - this.firstRenderDate;

        var renderTime = new Date() - this.lastRenderDate;
        this.lastRenderDate = new Date();
        var rotateCameraBy = (2 * Math.PI)/(20000/renderTime);

        this.cameraAngle += rotateCameraBy;

        this.camera.position.x = this.cameraDistance * Math.cos(this.cameraAngle);
        this.camera.position.y = 400;
        this.camera.position.z = this.cameraDistance * Math.sin(this.cameraAngle);

        for(var i = 0; i< this.satelliteMeshes.length; i++){
            var mesh = this.satelliteMeshes[i];
            // this.satelliteMeshes[i].rotation.y-=rotateCameraBy;
            mesh.lookAt(this.camera.position);
            mesh.rotateZ(mesh.tiltDirection * Math.PI/2);
            mesh.rotateZ(Math.sin(this.cameraAngle + (mesh.lon / 180) * Math.PI) * mesh.tiltMultiplier * mesh.tiltDirection * -1);


        }

        if(this.swirlTime > this.totalRunTime){
            if(this.totalRunTime/this.swirlTime < .1){
                this.swirlMaterial.opacity = (this.totalRunTime/this.swirlTime)*10 - .2;
            } else if(this.totalRunTime/this.swirlTime < .9){
                this.swirlMaterial.opacity = .8;
            }if(this.totalRunTime/this.swirlTime > .9){
                // this.swirlMaterial.opacity = Math.max(1-this.totalRunTime/this.swirlTime,0);
            }
            this.swirl.rotateY((2 * Math.PI)/(this.swirlTime/renderTime));
        } else if(this.swirl){
            this.scene.remove(this.swirl);
            delete[this.swirl];

        }

        // do the particles

        this.smokeUniforms.currentTime.value = this.totalRunTime;

        this.camera.lookAt( this.scene.position );
        this.renderer.render( this.scene, this.camera );
        updateSatellites.call(this, renderTime);

    }

    ENCOM.Globe = Globe;

    return ENCOM;

})(ENCOM || {}, THREE, document);
