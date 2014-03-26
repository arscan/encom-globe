;var ENCOM = (function(ENCOM, THREE, document){

var renderToCanvas = function (width, height, renderFunction) {
    var buffer = document.createElement('canvas');
        buffer.width = width;
        buffer.height = height;
        renderFunction(buffer.getContext('2d'));

    return buffer;
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

/* from http://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb */

function hexToRgb(hex) {
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, function(m, r, g, b) {
        return r + r + g + g + b + b;
    });

    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

var createLabel = function(text, size, color, font, underlineColor) {

    var canvas = document.createElement("canvas");
    var context = canvas.getContext("2d");
    context.font = size + "pt " + font;

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
    context.font = size + "pt " + font;

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

    /*

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
*/

    return canvas;

}

// based on http://stemkoski.github.io/Three.js/Texture-Animation.html
var TextureAnimator = function(texture, tilesVert, tilesHoriz, numTiles, tileDispDuration, repeatAtTile) 
{   
    // note: texture passed by reference, will be updated by the update function.

    if(repeatAtTile == undefined){
        this.repeatAtTile=-1;
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

var Satellite = (function(TextureAnimator, THREE, document){

    var createCanvas = function(numFrames, pixels, rows, waveStart, numWaves, waveColor, coreColor, shieldColor) {

        var cols = numFrames / rows;
        var waveInterval = Math.floor((numFrames-waveStart)/numWaves);
        var waveDist = pixels - 25; // width - center of satellite
        var distPerFrame = waveDist / (numFrames-waveStart)
        var offsetx = 0;
        var offsety = 0;
        var curRow = 0;

        var waveColorRGB = hexToRgb(waveColor);

        return renderToCanvas(numFrames * pixels / rows, pixels * rows, function(ctx){

            for(var i = 0; i< numFrames; i++){
                if(i - curRow * cols >= cols){
                    offsetx = 0;
                    offsety += pixels;
                    curRow++;
                }

                var centerx = offsetx + 25;
                var centery = offsety + Math.floor(pixels/2);

                /* circle around core */
                // i have between 0 and wavestart to fade in
                // i have between wavestart and  waveend - (time between waves*2) 
                // to do a full spin close and then back open
                // i have between waveend-2*(timebetween waves)/2 and waveend to rotate Math.PI/4 degrees
                // this is probably the ugliest code in all of here -- basically I just messed arund with stuff until it looked ok

                ctx.lineWidth=2;
                ctx.strokeStyle=shieldColor;
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
                        ctx.strokeStyle="rgba(" + waveColorRGB.r + "," + waveColorRGB.g + "," + waveColorRGB.b + "," + (.9-frameOn*distPerFrame/(pixels-25)) + ")";
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

                ctx.strokeStyle=coreColor;
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

    var Satellite = function(lat, lon, altitude, scene, _opts, canvas, texture){

        var geometry, 
            material,
            point = mapPoint(lat, lon),
            opts,
            numFrames,
            pixels,
            rows,
            waveStart,
            repeatAt;

        point.x *= altitude;
        point.y *= altitude;
        point.z *= altitude;

        /* options that can be passed in */
        var opts = {
            numWaves: 8,
            waveColor: "#FFF",
            coreColor: "#FF0000",
            shieldColor: "#FFF",
            size: 1
        }

        /* required field */
        this.lat = lat;
        this.lon = lon;
        this.altitude = altitude;
        this.scene = scene;

        this.onRemoveList = [];

        /* private vars */
        numFrames = 50;
        pixels = 100;
        rows = 10;
        waveStart = Math.floor(numFrames/8);

        if(_opts){
            for(var i in opts){
                if(_opts[i] != undefined){
                    opts[i] = _opts[i];
                }
            }
        }

        if(!canvas){
            this.canvas = createCanvas(numFrames, pixels, rows, waveStart, opts.numWaves, opts.waveColor, opts.coreColor, opts.shieldColor);
            this.texture = new THREE.Texture(this.canvas)
            this.texture.needsUpdate = true;
            repeatAt = Math.floor(numFrames-2*(numFrames-waveStart)/opts.numWaves)+1;
            this.animator = new TextureAnimator(this.texture,rows, numFrames/rows, numFrames, 80, repeatAt); 
        } else {
            this.canvas = canvas;
            if(!texture){
                this.texture = new THREE.Texture(this.canvas)
                this.texture.needsUpdate = true;
                repeatAt = Math.floor(numFrames-2*(numFrames-waveStart)/opts.numWaves)+1;
                this.animator = new TextureAnimator(this.texture,rows, numFrames/rows, numFrames, 80, repeatAt); 
            } else {
                this.texture = texture;
            }
        }

        geometry = new THREE.PlaneGeometry(opts.size * 150, opts.size * 150,1,1);
        material = new THREE.MeshBasicMaterial({
            map : this.texture,
            transparent: true
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.tiltMultiplier = Math.PI/2 * (1 - Math.abs(lat / 90));
        this.mesh.tiltDirection = (lat > 0 ? -1 : 1);
        this.mesh.lon = lon;

        this.mesh.position.set(point.x, point.y, point.z);

        this.mesh.rotation.z = -1*(lat/90)* Math.PI/2;
        this.mesh.rotation.y = (lon/180)* Math.PI

        scene.add(this.mesh);

    }

    Satellite.prototype.tick = function(cameraPosition, cameraAngle, renderTime) {
        // underscore should be good enough
        
        this.mesh.lookAt(cameraPosition);

        this.mesh.rotateZ(this.mesh.tiltDirection * Math.PI/2);
        this.mesh.rotateZ(Math.sin(cameraAngle + (this.mesh.lon / 180) * Math.PI) * this.mesh.tiltMultiplier * this.mesh.tiltDirection * -1);

        if(this.animator){
            this.animator.update(renderTime);
        }


    };

    Satellite.prototype.remove = function() {


        this.scene.remove(this.mesh);

        for(var i = 0; i< this.onRemoveList.length; i++){
            this.onRemoveList[i]();
        }
    };

    Satellite.prototype.onRemove = function(fn){
        this.onRemoveList.push(fn);
    }

    Satellite.prototype.toString = function(){
        return "" + this.lat + '_' + this.lon + '_' + this.altitude;
    };

    return Satellite;

})(TextureAnimator, THREE, document);

var SmokeProvider = (function(THREE, document){

    var vertexShader = [
        "#define PI 3.141592653589793238462643",
        "#define DISTANCE 500.0",
        "attribute float myStartTime;",
        "attribute float myStartLat;",
        "attribute float myStartLon;",
        "attribute float altitude;",
        "attribute float active;",
        "uniform float currentTime;",
        "uniform vec3 color;",
        "varying vec4 vColor;",
        "",
        "vec3 getPos(float lat, float lon)",
        "{",
        "   if (lon < -180.0){",
        "      lon = lon + 360.0;",
        "   }",
        "   float phi = (90.0 - lat) * PI / 180.0;",
        "   float theta = (180.0 - lon) * PI / 180.0;",
        "   float x = DISTANCE * sin(phi) * cos(theta) * altitude;",
        "   float y = DISTANCE * cos(phi) * altitude;",
        "   float z = DISTANCE * sin(phi) * sin(theta) * altitude;",
        "   return vec3(x, y, z);",
        "}",
        "",
        "void main()",
        "{",
        "   float dt = currentTime - myStartTime;",
        "   if (dt < 0.0){",
        "      dt = 0.0;",
        "   }",
        "   if (dt > 0.0 && active > 0.0) {",
        "      dt = mod(dt,1500.0);",
        "   }",
        "   float opacity = 1.0 - dt/ 1500.0;",
        "   if (dt == 0.0 || active == 0.0){",
        "      opacity = 0.0;",
        "   }",
        "   vec3 newPos = getPos(myStartLat, myStartLon - ( dt / 50.0));",
        "   vColor = vec4( color, opacity );", //     set color associated to vertex; use later in fragment shader.
        "   vec4 mvPosition = modelViewMatrix * vec4( newPos, 1.0 );",
        "   gl_PointSize = 2.5 - (dt / 1500.0);",
        "   gl_Position = projectionMatrix * mvPosition;",
        "}"
    ].join("\n");

    var fragmentShader = [
        "varying vec4 vColor;",     
        "void main()", 
        "{",
        "   float depth = gl_FragCoord.z / gl_FragCoord.w;",
        "   float fogFactor = smoothstep(1500.0, 2075.0, depth );",
        "   vec3 fogColor = vec3(0.0);",
        "   gl_FragColor = mix( vColor, vec4( fogColor, gl_FragColor.w ), fogFactor );",
        "}"
    ].join("\n");

    var SmokeProvider = function(scene, _opts){

        /* options that can be passed in */
        var opts = {
            smokeCount: 5000,
            smokePerPin: 30,
            smokePerSecond: 20
        }

        if(_opts){
            for(var i in opts){
                if(_opts[i] !== undefined){
                    opts[i] = _opts[i];
                }
            }
        }

        this.opts = opts;
        this.geometry = new THREE.Geometry();
        this.attributes = {
            myStartTime: {type: 'f', value: []},
            myStartLat: {type: 'f', value: []},
            myStartLon: {type: 'f', value: []},
            altitude: {type: 'f', value: []},
            active: {type: 'f', value: []}
        };

        this.uniforms = {
            currentTime: { type: 'f', value: 0.0},
            color: { type: 'c', value: new THREE.Color("#aaa")},
        }

        var material = new THREE.ShaderMaterial( {
            uniforms:       this.uniforms,
            attributes:     this.attributes,
            vertexShader:   vertexShader,
            fragmentShader: fragmentShader,
            transparent:    true
        });

        for(var i = 0; i< opts.smokeCount; i++){
            var vertex = new THREE.Vector3();
            vertex.set(0,0,0);
            this.geometry.vertices.push( vertex );
            this.attributes.myStartTime.value[i] = 0.0;
            this.attributes.myStartLat.value[i] = 0.0;
            this.attributes.myStartLon.value[i] = 0.0;
            this.attributes.altitude.value[i] = 0.0;
            this.attributes.active.value[i] = 0.0;
        }

        this.attributes.myStartTime.needsUpdate = true;
        this.attributes.myStartLat.needsUpdate = true;
        this.attributes.myStartLon.needsUpdate = true;
        this.attributes.altitude.needsUpdate = true;
        this.attributes.active.needsUpdate = true;

        this.smokeIndex = 0;
        this.totalRunTime = 0;

        scene.add( new THREE.ParticleSystem( this.geometry, material));

    };

    SmokeProvider.prototype.setFire = function(lat, lon, altitude){

        var point = mapPoint(lat, lon);

        /* add the smoke */
        var startSmokeIndex = this.smokeIndex;

        for(var i = 0; i< this.opts.smokePerPin; i++){
            this.geometry.vertices[this.smokeIndex].set(point.x * altitude, point.y * altitude, point.z * altitude);
            this.geometry.verticesNeedUpdate = true;
            this.attributes.myStartTime.value[this.smokeIndex] = this.totalRunTime + (1000*i/this.opts.smokePerSecond + 1500);
            this.attributes.myStartLat.value[this.smokeIndex] = lat;
            this.attributes.myStartLon.value[this.smokeIndex] = lon;
            this.attributes.altitude.value[this.smokeIndex] = altitude;
            this.attributes.active.value[this.smokeIndex] = 1.0;

            this.attributes.myStartTime.needsUpdate = true;
            this.attributes.myStartLat.needsUpdate = true;
            this.attributes.myStartLon.needsUpdate = true;
            this.attributes.altitude.needsUpdate = true;
            this.attributes.active.needsUpdate = true;

            this.smokeIndex++;
            this.smokeIndex = this.smokeIndex % this.geometry.vertices.length;
        }


        return startSmokeIndex;

    };

    SmokeProvider.prototype.extinguish = function(index){
        for(var i = 0; i< this.opts.smokePerPin; i++){
            this.attributes.active.value[(i + index) % this.opts.smokeCount] = 0.0;
            this.attributes.active.needsUpdate = true;
        }
    };

    SmokeProvider.prototype.changeAltitude = function(altitude, index){
        for(var i = 0; i< this.opts.smokePerPin; i++){
            this.attributes.altitude.value[(i + index) % this.opts.smokeCount] = altitude;
            this.attributes.altitude.needsUpdate = true;
        }

    };

    SmokeProvider.prototype.tick = function(totalRunTime){
        this.totalRunTime = totalRunTime;
        this.uniforms.currentTime.value = this.totalRunTime;
    };



    return SmokeProvider;

})(THREE, document);




var Pin = (function(THREE, TWEEN, document){

    var createTopCanvas = function(color) {
        var markerWidth = 20,
        markerHeight = 20;

        return renderToCanvas(markerWidth, markerHeight, function(ctx){
            ctx.fillStyle=color;
            ctx.beginPath();
            ctx.arc(markerWidth/2, markerHeight/2, markerWidth/4, 0, 2* Math.PI);
            ctx.fill();
        });

    };

    var Pin = function(lat, lon, text, altitude, scene, smokeProvider, _opts){

        /* options that can be passed in */
        var opts = {
            lineColor: "#8FD8D8",
            lineWidth: 1,
            topColor: "#8FD8D8",
            smokeColor: "#FFF",
            labelColor: "#FFF",
            font: "Inconsolata",
            showLabel: (text.length > 0),
            showTop: (text.length > 0),
            showSmoke: (text.length > 0)
        }

        var lineMaterial,
           labelCanvas,
           labelTexture,
           labelMaterial,
           topTexture,
           topMaterial,
           point,
           line;

        this.lat = lat;
        this.lon = lon;
        this.text = text;
        this.altitude = altitude;
        this.scene = scene;
        this.smokeProvider = smokeProvider;
        this.dateCreated = Date.now();

        if(_opts){
            for(var i in opts){
                if(_opts[i] != undefined){
                    opts[i] = _opts[i];
                }
            }
        }

        this.opts = opts;

        this.topVisible = opts.showTop;
        this.smokeVisible = opts.showSmoke;
        this.labelVisible = opts.showLabel;

        /* the line */

        this.lineGeometry = new THREE.Geometry();
        lineMaterial = new THREE.LineBasicMaterial({
            color: opts.lineColor,
            linewidth: opts.lineWidth
        });

        point = mapPoint(lat,lon);

        this.lineGeometry.vertices.push(new THREE.Vector3(point.x, point.y, point.z));
        this.lineGeometry.vertices.push(new THREE.Vector3(point.x, point.y, point.z));
        this.line = new THREE.Line(this.lineGeometry, lineMaterial);

        /* the label */

        labelCanvas = createLabel(text, 18, opts.labelColor, opts.font);
        labelTexture = new THREE.Texture(labelCanvas);
        labelTexture.needsUpdate = true;

        labelMaterial = new THREE.SpriteMaterial({
           map : labelTexture,
           useScreenCoordinates: false,
           opacity:0,
           depthTest: false,
           fog: true
        });

       this.labelSprite = new THREE.Sprite(labelMaterial);
       this.labelSprite.position = {x: point.x*altitude*1.1, y: point.y*altitude + (point.y < 0 ? -15 : 30), z: point.z*altitude*1.1};
       this.labelSprite.scale.set(labelCanvas.width, labelCanvas.height);

       /* the top */

       topTexture = new THREE.Texture(createTopCanvas(opts.topColor));
       topTexture.needsUpdate = true;
       topMaterial = new THREE.SpriteMaterial({map: topTexture, depthTest: false, fog: true, opacity: 0});
       this.topSprite = new THREE.Sprite(topMaterial);
       this.topSprite.scale.set(20, 20);
       this.topSprite.position.set(point.x * altitude, point.y * altitude, point.z * altitude);

       /* the smoke */
       if(this.smokeVisible){
           this.smokeId = smokeProvider.setFire(lat, lon, altitude);
       }

       /* intro animations */

       if(opts.showTop || opts.showLabel){
           new TWEEN.Tween( {opacity: 0})
               .to( {opacity: 1}, 500 )
               .onUpdate(function(){
                   if(opts.showTop){
                       topMaterial.opacity = this.opacity;
                   }
                   labelMaterial.opacity = this.opacity;
               }).delay(1000)
               .start();
       }

       var _this = this; //arghhh

       new TWEEN.Tween(point)
       .to( {x: point.x*altitude, y: point.y*altitude, z: point.z*altitude}, 1500 )
       .easing( TWEEN.Easing.Elastic.Out )
       .onUpdate(function(){
           _this.lineGeometry.vertices[1].x = this.x;
           _this.lineGeometry.vertices[1].y = this.y;
           _this.lineGeometry.vertices[1].z = this.z;
           _this.lineGeometry.verticesNeedUpdate = true;
       }).start();

        /* add to scene */

        this.scene.add(this.labelSprite);
        this.scene.add(this.line);
        this.scene.add(this.topSprite);

    };

    Pin.prototype.toString = function(){
        return "" + this.lat + "_" + this.lon;
    }

    Pin.prototype.changeAltitude = function(altitude){
        var point = mapPoint(this.lat, this.lon);
        var _this = this; // arghhhh

       new TWEEN.Tween({altitude: this.altitude})
       .to( {altitude: altitude}, 1500 )
       .easing( TWEEN.Easing.Elastic.Out )
       .onUpdate(function(){
           if(_this.smokeVisible){
               _this.smokeProvider.changeAltitude(this.altitude, _this.smokeId);
           }
           if(_this.topVisible){
               _this.topSprite.position.set(point.x * this.altitude, point.y * this.altitude, point.z * this.altitude);
           }
           if(_this.labelVisible){
               _this.labelSprite.position = {x: point.x*this.altitude*1.1, y: point.y*this.altitude + (point.y < 0 ? -15 : 30), z: point.z*this.altitude*1.1};
           }
           _this.lineGeometry.vertices[1].x = point.x * this.altitude;
           _this.lineGeometry.vertices[1].y = point.y * this.altitude;
           _this.lineGeometry.vertices[1].z = point.z * this.altitude;
           _this.lineGeometry.verticesNeedUpdate = true;

       })
       .onComplete(function(){
           _this.altitude = altitude;
           
       }).start();

    };

    Pin.prototype.hideTop = function(){
        if(this.topVisible){
            this.topSprite.material.opacity = 0.0;
            this.topVisible = false;
        }
    };

    Pin.prototype.showTop = function(){
        if(!this.topVisible){
            this.topSprite.material.opacity = 1.0;
            this.topVisible = true;
        }
    };

    Pin.prototype.hideLabel = function(){
        if(this.labelVisible){
            this.labelSprite.material.opacity = 0.0;
            this.labelVisible = false;
        }
    };

    Pin.prototype.showLabel = function(){
        if(!this.labelVisible){
            this.labelSprite.material.opacity = 1.0;
            this.labelVisible = true;
        }
    };

    Pin.prototype.hideSmoke = function(){
        if(this.smokeVisible){
            this.smokeProvider.extinguish(this.smokeId);
            this.smokeVisible = false;
        }
    };

    Pin.prototype.showSmoke = function(){
        if(!this.smokeVisible){
            this.smokeId  = this.smokeProvider.setFire(this.lat, this.lon, this.altitude);
            this.smokeVisible = true;
        }
    };

    Pin.prototype.age = function(){
        return Date.now() - this.dateCreated;

    };

    Pin.prototype.remove = function(){
        this.scene.remove(this.labelSprite);
        this.scene.remove(this.line);
        this.scene.remove(this.topSprite);

        if(this.smokeVisible){
            this.smokeProvider.extinguish(this.smokeId);
        }
    };

    return Pin;

})(THREE, TWEEN, document);

var Marker = (function(THREE, TWEEN, document){

    var createMarkerTexture = function(markerColor) {
        var markerWidth = 30,
            markerHeight = 30,
            canvas,
            texture;

        canvas =  renderToCanvas(markerWidth, markerHeight, function(ctx){
            ctx.strokeStyle=markerColor;
            ctx.lineWidth=3;
            ctx.beginPath();
            ctx.arc(markerWidth/2, markerHeight/2, markerWidth/3, 0, 2* Math.PI);
            ctx.stroke();

            ctx.fillStyle=markerColor;
            ctx.beginPath();
            ctx.arc(markerWidth/2, markerHeight/2, markerWidth/5, 0, 2* Math.PI);
            ctx.fill();

        });

        texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;

        return texture;

    };

    var Marker = function(lat, lon, text, altitude, previous, scene, _opts){

        /* options that can be passed in */
        var opts = {
            lineColor: "#FFCC00",
            lineWidth: 1,
            markerColor: "#FFCC00",
            labelColor: "#FFF",
            font: "Inconsolata",
            fontSize: 20,
            drawTime: 2000,
            lineSegments: 200
        }

        var point,
            previousPoint,
            markerMaterial,
            labelCanvas,
            labelTexture,
            labelMaterial
            ;


        this.lat = parseFloat(lat);
        this.lon = parseFloat(lon);
        this.text = text;
        this.altitude = parseFloat(altitude);
        this.scene = scene;
        this.previous = previous;
        this.next = [];

        if(this.previous){
            this.previous.next.push(this);
        }

        if(_opts){
            for(var i in opts){
                if(_opts[i] != undefined){
                    opts[i] = _opts[i];
                }
            }
        }

        this.opts = opts;

        
        point = mapPoint(lat, lon);

        if(previous){
            previousPoint = mapPoint(previous.lat, previous.lon);
        }

        if(!scene._encom_markerTexture){
            scene._encom_markerTexture = createMarkerTexture(this.opts.markerColor);
        }

        markerMaterial = new THREE.SpriteMaterial({map: scene._encom_markerTexture, opacity: .7, depthTest: false, fog: true});
        this.marker = new THREE.Sprite(markerMaterial);

        this.marker.scale.set(0, 0);
        this.marker.position.set(point.x * altitude, point.y * altitude, point.z * altitude);

        labelCanvas = createLabel(text.toUpperCase(), this.opts.fontSize, this.opts.labelColor, this.opts.font, this.opts.markerColor);
        labelTexture = new THREE.Texture(labelCanvas);
        labelTexture.needsUpdate = true;

        labelMaterial = new THREE.SpriteMaterial({
            map : labelTexture,
            useScreenCoordinates: false,
            opacity: 0,
            depthTest: false,
            fog: true
        });

        this.labelSprite = new THREE.Sprite(labelMaterial);
        this.labelSprite.position = {x: point.x * altitude * 1.1, y: point.y*altitude*1.05 + (point.y < 0 ? -15 : 30), z: point.z * altitude * 1.1};
        this.labelSprite.scale.set(labelCanvas.width, labelCanvas.height);

        new TWEEN.Tween( {opacity: 0})
        .to( {opacity: 1}, 500 )
        .onUpdate(function(){
            labelMaterial.opacity = this.opacity
        }).start();


        var _this = this; //arrghghh

        new TWEEN.Tween({x: 0, y: 0})
        .to({x: 50, y: 50}, 2000)
        .easing( TWEEN.Easing.Elastic.Out )
        .onUpdate(function(){
            _this.marker.scale.set(this.x, this.y);
        })
        .delay((this.previous ? _this.opts.drawTime : 0))
        .start();

      if(this.previous){

          var materialSpline,
              materialSplineDotted,
              latdist,
              londist,
              startPoint,
              pointList = [],
              pointList2 = [],
              nextlat,
              nextlon,
              currentLat,
              currentLon,
              currentPoint,
              currentVert,
              update;

            _this.geometrySpline = new THREE.Geometry();
            materialSpline = new THREE.LineBasicMaterial({
                color: this.opts.lineColor,
                transparent: true,
                linewidth: 3,
                opacity: .5
            });

            _this.geometrySplineDotted = new THREE.Geometry();
            materialSplineDotted = new THREE.LineBasicMaterial({
                color: this.opts.lineColor,
                linewidth: 1,
                transparent: true,
                opacity: .5
            });

            latdist = (lat - previous.lat)/_this.opts.lineSegments;
            londist = (lon - previous.lon)/_this.opts.lineSegments;
            startPoint = mapPoint(previous.lat,previous.lon);
            pointList = [];
            pointList2 = [];

            for(var j = 0; j< _this.opts.lineSegments + 1; j++){
                // var nextlat = ((90 + lat1 + j*1)%180)-90;
                // var nextlon = ((180 + lng1 + j*1)%360)-180;


                var nextlat = (((90 + previous.lat + j*latdist)%180)-90) * (.5 + Math.cos(j*(5*Math.PI/2)/_this.opts.lineSegments)/2) + (j*lat/_this.opts.lineSegments/2);
                var nextlon = ((180 + previous.lon + j*londist)%360)-180;
                pointList.push({lat: nextlat, lon: nextlon, index: j});
                if(j == 0 || j == _this.opts.lineSegments){
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

                _this.geometrySpline.vertices.push(sPoint);  
                _this.geometrySplineDotted.vertices.push(sPoint2);  
            }


            currentLat = previous.lat;
            currentLon = previous.lon;
            currentPoint;
            currentVert;

            update = function(){
                var nextSpot = pointList.shift();
                var nextSpot2 = pointList2.shift();

                for(var x = 0; x< _this.geometrySpline.vertices.length; x++){

                    currentVert = _this.geometrySpline.vertices[x];
                    currentPoint = mapPoint(nextSpot.lat, nextSpot.lon);

                    currentVert2 = _this.geometrySplineDotted.vertices[x];
                    currentPoint2 = mapPoint(nextSpot2.lat, nextSpot2.lon);

                    if(x >= nextSpot.index){
                        currentVert.set(currentPoint.x*1.2, currentPoint.y*1.2, currentPoint.z*1.2);
                        currentVert2.set(currentPoint2.x*1.19, currentPoint2.y*1.19, currentPoint2.z*1.19);
                    }
                    _this.geometrySpline.verticesNeedUpdate = true;
                    _this.geometrySplineDotted.verticesNeedUpdate = true;
                }
                if(pointList.length > 0){
                    setTimeout(update,_this.opts.drawTime/_this.opts.lineSegments);
                }

            };

            update();

            this.scene.add(new THREE.Line(_this.geometrySpline, materialSpline));
            this.scene.add(new THREE.Line(_this.geometrySplineDotted, materialSplineDotted, THREE.LinePieces));
        }

        this.scene.add(this.marker);
        this.scene.add(this.labelSprite);

    };

    Marker.prototype.remove = function(){
        var x = 0;
        var _this = this;

        var update = function(ref){

            for(var i = 0; i< x; i++){
                ref.geometrySpline.vertices[i].set(ref.geometrySpline.vertices[i+1]);
                ref.geometrySplineDotted.vertices[i].set(ref.geometrySplineDotted.vertices[i+1]);
                ref.geometrySpline.verticesNeedUpdate = true;
                ref.geometrySplineDotted.verticesNeedUpdate = true;
            }

            x++;
            if(x < ref.geometrySpline.vertices.length){
                setTimeout(function(){update(ref)}, _this.opts.drawTime/_this.opts.lineSegments)
            } else {
                _this.scene.remove(ref.geometrySpline);
                _this.scene.remove(ref.geometrySplineDotted);
            }
        }

        for(var j = 0; j< _this.next.length; j++){
            (function(k){
                update(_this.next[k]);
            })(j);
        } 

        _this.scene.remove(_this.marker);
        _this.scene.remove(_this.labelSprite);

    };

    return Marker;




})(THREE, TWEEN, document);


var Globe = (function(THREE, TWEEN, document){

    var latLonToXYZ = function(width, height, lat,lon){

        var x = Math.floor(width/2.0 + (width/360.0)*lon);
        var y = Math.floor(height - (height/2.0 + (height/180.0)*lat));

        return {x: x, y:y};
    };

    var samplePoints = function(projectionContext, width, height, latoffset, lonoffset, latinc, loninc, cb){
        var points = [],
        pixelData = null;

        var isPixelBlack = function(context, x, y, width, height){
            if(pixelData == null){
                pixelData = context.getImageData(0,0,width, height);
            }
            return pixelData.data[(y * pixelData.width + x) * 4] === 0;
        };

        for(var lat = 90-latoffset; lat > -90; lat -= latinc){
            for(var lon = -180+lonoffset; lon < 180; lon += loninc){
                var point = latLonToXYZ(width, height, lat, lon);
                if(isPixelBlack(projectionContext,point.x, point.y, width, height)){
                    cb({lat: lat, lon: lon});
                    points.push({lat: lat, lon: lon});
                }
            }
        }
        return points;
    };


    var addInitialData = function(){
        if(this.data.length == 0){
            return;
        }
        while(this.data.length > 0 && this.firstRunTime + (next = this.data.pop()).when < Date.now()){
            this.addPin(next.lat, next.lng, next.label);
        }

        if(this.firstRunTime + next.when >= Date.now()){
            this.data.push(next);
        }
    };


    var createParticles = function(){

        var pointVertexShader = [
            "#define PI 3.141592653589793238462643",
            "#define DISTANCE 500.0",
            "#define INTRODURATION " + (parseFloat(this.introLinesDuration) + .00001),
            "#define INTROALTITUDE " + (parseFloat(this.introLinesAltitude) + .00001),
            "attribute float lng;",
            "uniform float currentTime;",
            "varying vec4 vColor;",
            "",
            "void main()",
            "{",
            "   vec3 newPos = position;",
            "   float opacity = 0.0;",
            "   float introStart = INTRODURATION * ((180.0 + lng)/360.0);",
            "   if(currentTime > introStart){",
            "      opacity = 1.0;",
            "   }",
            "   if(currentTime > introStart && currentTime < introStart + INTRODURATION / 8.0){",
            "      newPos = position * INTROALTITUDE;",
            "      opacity = .3;",
            "   }",
            "   if(currentTime > introStart + INTRODURATION / 8.0 && currentTime < introStart + INTRODURATION / 8.0 + 200.0){",
            "      newPos = position * (1.0 + ((INTROALTITUDE-1.0) * (1.0-(currentTime - introStart-(INTRODURATION/8.0))/200.0)));",
            "   }",
            "   vColor = vec4( color, opacity );", //     set color associated to vertex; use later in fragment shader.
            "   gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);",
            "}"
        ].join("\n");

        var pointFragmentShader = [
            "varying vec4 vColor;",     
            "void main()", 
            "{",
            "   float depth = gl_FragCoord.z / gl_FragCoord.w;",
            "   float fogFactor = smoothstep(" + (parseInt(this.cameraDistance)-200) +".0," + (parseInt(this.cameraDistance+375)) +".0, depth );",
            "   vec3 fogColor = vec3(0.0);",
            "   gl_FragColor = mix( vColor, vec4( fogColor, gl_FragColor.w ), fogFactor );",
            "}"
        ].join("\n");

        var pointAttributes = {
            lng: {type: 'f', value: null}
        };

        this.pointUniforms = {
            currentTime: { type: 'f', value: 0.0}
        }

        var pointMaterial = new THREE.ShaderMaterial( {
            uniforms:       this.pointUniforms,
            attributes:     pointAttributes,
            vertexShader:   pointVertexShader,
            fragmentShader: pointFragmentShader,
            transparent:    true,
            vertexColors: THREE.VertexColors,
            side: THREE.DoubleSide
        });

        var hexes = this.points.length;
        var triangles = hexes * 4;

        var geometry = new THREE.BufferGeometry();

        geometry.addAttribute( 'index', Uint16Array, triangles * 3, 1 );
        geometry.addAttribute( 'position', Float32Array, triangles * 3, 3 );
        geometry.addAttribute( 'normal', Float32Array, triangles * 3, 3 );
        geometry.addAttribute( 'color', Float32Array, triangles * 3, 3 );
        geometry.addAttribute( 'lng', Float32Array, triangles * 3, 1 );

        var lng_values = geometry.attributes.lng.array;


        var baseColorSet = pusher.color(this.baseColor).hueSet();
        var myColors = [];
        for(var i = 0; i< baseColorSet.length; i++){
            myColors.push(baseColorSet[i].shade(Math.random()/3.0));
        }

        // break geometry into
        // chunks of 21,845 triangles (3 unique vertices per triangle)
        // for indices to fit into 16 bit integer number
        // floor(2^16 / 3) = 21845

        var chunkSize = 21845;

        var indices = geometry.attributes.index.array;

        for ( var i = 0; i < indices.length; i ++ ) {

            indices[ i ] = i % ( 3 * chunkSize );

        }

        var positions = geometry.attributes.position.array;
        var colors = geometry.attributes.color.array;

        var n = 800, n2 = n/2;  // triangles spread in the cube
        var d = 12, d2 = d/2;   // individual triangle size

        var pA = new THREE.Vector3();
        var pB = new THREE.Vector3();
        var pC = new THREE.Vector3();

        var cb = new THREE.Vector3();
        var ab = new THREE.Vector3();


        var addTriangle = function(k, ax, ay, az, bx, by, bz, cx, cy, cz, lat, lng, color){
            var p = k * 3;
            var i = p * 3;
            var colorIndex = Math.floor(Math.random()*myColors.length);
            var colorRGB = myColors[colorIndex].rgb();

            lng_values[p] = lng;
            lng_values[p+1] = lng;
            lng_values[p+2] = lng;

            positions[ i ]     = ax;
            positions[ i + 1 ] = ay;
            positions[ i + 2 ] = az;

            positions[ i + 3 ] = bx;
            positions[ i + 4 ] = by;
            positions[ i + 5 ] = bz;

            positions[ i + 6 ] = cx;
            positions[ i + 7 ] = cy;
            positions[ i + 8 ] = cz;

            colors[ i ]     = color.r;
            colors[ i + 1 ] = color.g;
            colors[ i + 2 ] = color.b;

            colors[ i + 3 ] = color.r;
            colors[ i + 4 ] = color.g;
            colors[ i + 5 ] = color.b;

            colors[ i + 6 ] = color.r;
            colors[ i + 7 ] = color.g;
            colors[ i + 8 ] = color.b;

        };

        var addHex = function(i, lat, lng){
            var k = i * 4;
            // var C = Math.random()*.25 + .25;
            var C = 1/this.pointsPerDegree * Math.min(1,this.pointSize * (1 + (Math.random() * (2*this.pointsVariance)) - this.pointsVariance));
            var B = .866*C;
            var A = C/2;

            var p1 = mapPoint(lat + 0 - B, lng + A + C - B, 500);
            var p2 = mapPoint(lat + 0 - B, lng + A - B, 500);
            var p3 = mapPoint(lat + B - B, lng + 0 - B, 500);
            var p4 = mapPoint(lat + 2*B - B, lng + A - B, 500);
            var p5 = mapPoint(lat + 2*B - B, lng + A + C - B, 500);
            var p6 = mapPoint(lat + B - B, lng + 2*C - B, 500);

            var colorIndex = Math.floor(Math.random()*myColors.length);
            var colorRGB = myColors[colorIndex].rgb();
            var color = new THREE.Color();

            color.setRGB(colorRGB[0]/255.0, colorRGB[1]/255.0, colorRGB[2]/255.0);

            addTriangle(k, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p6.x, p6.y, p6.z, lat, lng, color);
            addTriangle(k+1, p2.x, p2.y, p2.z, p6.x, p6.y, p6.z, p3.x, p3.y, p3.z, lat, lng, color);
            addTriangle(k+2, p3.x, p3.y, p3.z, p6.x, p6.y, p6.z, p5.x, p5.y, p5.z, lat, lng, color);
            addTriangle(k+3, p4.x, p4.y, p4.z, p3.x, p3.y, p3.z, p5.x, p5.y, p5.z, lat, lng, color);

        };

        for(i = 0; i < this.points.length; i++){
            addHex.call(this, i, this.points[i].lat, this.points[i].lon);
        }

        geometry.offsets = [];

        var offsets = triangles / chunkSize;

        for ( var i = 0; i < offsets; i ++ ) {

            var offset = {
                start: i * chunkSize * 3,
                index: i * chunkSize * 3,
                count: Math.min( triangles - ( i * chunkSize ), chunkSize ) * 3
            };

            geometry.offsets.push( offset );

        }

        geometry.computeBoundingSphere();

        mesh = new THREE.Mesh( geometry, pointMaterial );
        this.scene.add( mesh );

    };

    var createIntroLines = function(){
        var sPoint;
        var introLinesMaterial = new THREE.LineBasicMaterial({
            color: this.introLinesColor,
            transparent: true,
            linewidth: 2,
            opacity: .5
        });

        for(var i = 0; i<this.introLinesCount; i++){
            var geometry = new THREE.Geometry();

            var lat = Math.random()*180 + 90;
            var lon =  Math.random()*5;
            var lenBase = 4 + Math.floor(Math.random()*5);

            if(Math.random()<.3){
                lon = Math.random()*30 - 50;
                lenBase = 3 + Math.floor(Math.random()*3);
            }

            for(var j = 0; j< lenBase; j++){
                var thisPoint = mapPoint(lat, lon - j * 5);
                sPoint = new THREE.Vector3(thisPoint.x*this.introLinesAltitude, thisPoint.y*this.introLinesAltitude, thisPoint.z*this.introLinesAltitude);

                geometry.vertices.push(sPoint);  
            }

            this.introLines.add(new THREE.Line(geometry, introLinesMaterial));

        }
        this.scene.add(this.introLines);
    };

    var removeMarker = function(marker){

        var pos = marker.line.geometry.vertices[1];
        var _this = this;
        var scaleDownBy = 1+ Math.random()*.2;

        if(!marker.active){
            return;
        }

        marker.active = false;

        // for(var i = marker.startSmokeIndex; i< marker.smokeCount + marker.startSmokeIndex; i++){
        //     var realI = i % _this.smokeAttributes.active.value.length;
        //     _this.smokeAttributes.active.value[realI] = 0.0;
        //     _this.smokeAttributes.active.needsUpdate = true;
        // }

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

    function Globe(width, height, opts){
        var baseSampleMultiplier = .7;

        if(!opts){
            opts = {};
        }

        this.width = width;
        this.height = height;
        // this.smokeIndex = 0;
        this.points = [];
        this.introLines = new THREE.Object3D();
        this.markers = [];
        this.quills = [];
        this.markerCoords = {};
        this.markerIndex = {};
        this.satelliteAnimations = [];
        this.satelliteMeshes = [];
        this.satellites = {};

        var defaults = {
            font: "Inconsolata",
            baseColor: "#ffcc00",
            blankPercentage: .08,
            thinAntarctica: .01, // only show 1% of antartica... you can't really see it on the map anyhow
            mapUrl: "resources/equirectangle_projection.png",
            introLinesAltitude: 1.10,
            introLinesDuration: 2000,
            introLinesColor: "#8FD8D8",
            introLinesCount: 60,
            cameraDistance: 1700,
            pointsPerDegree: 1.1,
            pointSize: .45,
            pointsVariance: .3,
            maxMarkers: 20,
            maxQuills:100,
            data: []
        };

        for(var i in defaults){
            if(!this[i]){
                this[i] = defaults[i];
                if(opts[i]){
                    this[i] = opts[i];
                }
            }
        }

        this.renderer = new THREE.WebGLRenderer( { antialias: true } );
        this.renderer.setSize( this.width, this.height);

        this.renderer.gammaInput = true;
        this.renderer.gammaOutput = true;

        this.domElement = this.renderer.domElement;

        this.data.sort(function(a,b){return (b.lng - b.label.length * 2) - (a.lng - a.label.length * 2)});

        for(var i = 0; i< this.data.length; i++){
            this.data[i].when = this.introLinesDuration*((180+this.data[i].lng)/360.0); 
        }

    }

    /* public globe functions */

    Globe.prototype.init = function(cb){
        var callbackCount = 0,
        img = document.createElement('img'),
        projectionCanvas = document.createElement('canvas'),
        projectionContext = projectionCanvas.getContext('2d');
        _this = this;

        document.body.appendChild(projectionCanvas);

        var registerCallback = function(){
            callbackCount++;

            return function(){

                callbackCount--;

                if(callbackCount == 0){
                    //image has loaded, may rsume
                    projectionCanvas.width = img.width;
                    projectionCanvas.height = img.height;
                    projectionContext.drawImage(img, 0, 0, img.width, img.height);

                    var samples= [
                        { 
                        offsetLat: 0,
                        offsetLon: 0,
                        incLat: (1 / _this.pointsPerDegree) * 2,
                        incLon: (1 /_this.pointsPerDegree) * 4
                    },
                    { 
                        offsetLat: (1 / _this.pointsPerDegree),
                        offsetLon: (1 / _this.pointsPerDegree) * 2,
                        incLat: (1 / _this.pointsPerDegree) * 2,
                        incLon: ( 1/ _this.pointsPerDegree) * 4
                    }
                    ];

                    for (var i = 0; i< samples.length; i++){

                        samplePoints(projectionContext,img.width, img.height, samples[i].offsetLat, samples[i].offsetLon, samples[i].incLat, samples[i].incLon, function(point){
                            if((point.lat > -60 && Math.random() > _this.blankPercentage) || Math.random() < _this.thinAntarctica){
                                _this.points.push(point);
                            }
                        });
                    }
                    document.body.removeChild(projectionCanvas);

                    // create the camera

                    _this.camera = new THREE.PerspectiveCamera( 50, _this.width / _this.height, 1, _this.cameraDistance + 250 );
                    _this.camera.position.z = _this.cameraDistance;

                    _this.cameraAngle=(Math.PI * 2) * .5;

                    // create the scene

                    _this.scene = new THREE.Scene();

                    _this.scene.fog = new THREE.Fog( 0x000000, _this.cameraDistance-200, _this.cameraDistance+250 );

                    createIntroLines.call(_this);

                    // pregenerate the satellite canvas
                    var numFrames = 50;
                    var pixels = 100;
                    var rows = 10;
                    var waveStart = Math.floor(numFrames/8);
                    var numWaves = 8;
                    var repeatAt = Math.floor(numFrames-2*(numFrames-waveStart)/numWaves)+1;
                    // _this.satelliteCanvas = createSatelliteCanvas.call(this, numFrames, pixels, rows, waveStart, numWaves);

                    // create the smoke particles

                    _this.smokeProvider = new SmokeProvider(_this.scene);

                    // initialize the smoke
                    // create particle system
                    // _this.smokeParticleGeometry = new THREE.Geometry();

                    // _this.smokeVertexShader = [
                    //     "#define PI 3.141592653589793238462643",
                    //     "#define DISTANCE 600.0",
                    //     "attribute float myStartTime;",
                    //     "attribute float myStartLat;",
                    //     "attribute float myStartLon;",
                    //     "attribute float active;",
                    //     "uniform float currentTime;",
                    //     "uniform vec3 color;",
                    //     "varying vec4 vColor;",
                    //     "",
                    //     "vec3 getPos(float lat, float lon)",
                    //     "{",
                    //     "   if (lon < -180.0){",
                    //     "      lon = lon + 360.0;",
                    //     "   }",
                    //     "   float phi = (90.0 - lat) * PI / 180.0;",
                    //     "   float theta = (180.0 - lon) * PI / 180.0;",
                    //     "   float x = DISTANCE * sin(phi) * cos(theta);",
                    //     "   float y = DISTANCE * cos(phi);",
                    //     "   float z = DISTANCE * sin(phi) * sin(theta);",
                    //     "   return vec3(x, y, z);",
                    //     "}",
                    //     "",
                    //     "void main()",
                    //     "{",
                    //     "   float dt = currentTime - myStartTime;",
                    //     "   if (dt < 0.0){",
                    //     "      dt = 0.0;",
                    //     "   }",
                    //     "   if (dt > 0.0 && active > 0.0) {",
                    //     "      dt = mod(dt,1500.0);",
                    //     "   }",
                    //     "   float opacity = 1.0 - dt/ 1500.0;",
                    //     "   if (dt == 0.0 || active == 0.0){",
                    //     "      opacity = 0.0;",
                    //     "   }",
                    //     "   vec3 newPos = getPos(myStartLat, myStartLon - ( dt / 50.0));",
                    //     "   vColor = vec4( color, opacity );", //     set color associated to vertex; use later in fragment shader.
                    //     "   vec4 mvPosition = modelViewMatrix * vec4( newPos, 1.0 );",
                    //     "   gl_PointSize = 2.5 - (dt / 1500.0);",
                    //     "   gl_Position = projectionMatrix * mvPosition;",
                    //     "}"
                    // ].join("\n");

                    // _this.smokeFragmentShader = [
                    //     "varying vec4 vColor;",     
                    //     "void main()", 
                    //     "{",
                    //     "   float depth = gl_FragCoord.z / gl_FragCoord.w;",
                    //     "   float fogFactor = smoothstep(" + (parseInt(_this.cameraDistance)-200) +".0," + (parseInt(_this.cameraDistance+375)) +".0, depth );",
                    //     "   vec3 fogColor = vec3(0.0);",
                    //     "   gl_FragColor = mix( vColor, vec4( fogColor, gl_FragColor.w ), fogFactor );",
                    //     "}"
                    // ].join("\n");

                    // _this.smokeAttributes = {
                    //     myStartTime: {type: 'f', value: []},
                    //     myStartLat: {type: 'f', value: []},
                    //     myStartLon: {type: 'f', value: []},
                    //     active: {type: 'f', value: []}
                    // };

                    // _this.smokeUniforms = {
                    //     currentTime: { type: 'f', value: 0.0},
                    //     color: { type: 'c', value: new THREE.Color("#aaa")},
                    // }

                    // _this.smokeMaterial = new THREE.ShaderMaterial( {
                    //     uniforms:       _this.smokeUniforms,
                    //     attributes:     _this.smokeAttributes,
                    //     vertexShader:   _this.smokeVertexShader,
                    //     fragmentShader: _this.smokeFragmentShader,
                    //     transparent:    true
                    // });

                    // for(var i = 0; i< 2000; i++){
                    //     var vertex = new THREE.Vector3();
                    //     vertex.set(0,0,_this.cameraDistance+1);
                    //     _this.smokeParticleGeometry.vertices.push( vertex );
                    //     _this.smokeAttributes.myStartTime.value[i] = 0.0;
                    //     _this.smokeAttributes.myStartLat.value[i] = 0.0;
                    //     _this.smokeAttributes.myStartLon.value[i] = 0.0;
                    //     _this.smokeAttributes.active.value[i] = 0.0;
                    // }
                    // _this.smokeAttributes.myStartTime.needsUpdate = true;
                    // _this.smokeAttributes.myStartLat.needsUpdate = true;
                    // _this.smokeAttributes.myStartLon.needsUpdate = true;
                    // _this.smokeAttributes.active.needsUpdate = true;

                    // _this.scene.add( new THREE.ParticleSystem( _this.smokeParticleGeometry, _this.smokeMaterial));


                    createParticles.call(_this);

                    cb();
                }

            }
        };

        img.addEventListener('load', registerCallback());

        img.src = this.mapUrl;
    };

    Globe.prototype.addPin = function(lat, lng, text){

        var altitude = 1.2;

        if(typeof text != "string" || text.length === 0){
            altitude -= Math.random() * .1;
        } else {
           altitude -= Math.random() * .1;
        }

        var pin = new Pin(lat, lng, text, altitude, this.scene, this.smokeProvider);


        return;
        

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
            var textSprite = createLabel.call(this,text, point.x*1.18, point.y*1.18, point.z*1.18, 18, "#fff", this.font);
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

    Globe.prototype.addMarker = function(lat, lon, text, previous){

        var marker = new Marker(lat, lon, text, 1.2, previous, this.scene);

        return marker;
    }

    Globe.prototype.addSatellite = function(lat, lon, altitude, opts, texture, animator){
        /* texture and animator are optimizations so we don't have to regenerate certain 
         * redundant assets */

        var satellite = new Satellite(lat, lon, altitude, this.scene, opts, texture, animator);

        if(!this.satellites[satellite.toString()]){
            this.satellites[satellite.toString()] = satellite;
        }

        satellite.onRemove(function(){
            delete this.satellites[satellite.toString()];
        }.bind(this));

        return satellite;

    };
    
    Globe.prototype.addConstellation = function(sats){

        /* TODO: make it so that when you remove the first in a constillation it removes all others */

        var texture,
            animator,
            satellite,
            constellation = [];

        for(var i = 0; i< sats.length; i++){
            if(i === 0){
               satellite = this.addSatellite(sats[i].lat, sats[i].lon, sats[i].altitude);
            } else {
               satellite = this.addSatellite(sats[i].lat, sats[i].lon, sats[i].altitude, null, constellation[0].canvas, constellation[0].texture);
            }
            constellation.push(satellite);

        }

        return constellation;

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
        if(!this.firstRunTime){
            this.firstRunTime = Date.now();
        }
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


        for(var i in this.satellites){
            this.satellites[i].tick(this.camera.position, this.cameraAngle, renderTime);
        }

        for(var i = 0; i< this.satelliteMeshes.length; i++){
            var mesh = this.satelliteMeshes[i];
            // this.satelliteMeshes[i].rotation.y-=rotateCameraBy;
            mesh.lookAt(this.camera.position);
            mesh.rotateZ(mesh.tiltDirection * Math.PI/2);
            mesh.rotateZ(Math.sin(this.cameraAngle + (mesh.lon / 180) * Math.PI) * mesh.tiltMultiplier * mesh.tiltDirection * -1);

        }

        if(this.introLinesDuration > this.totalRunTime){
            if(this.totalRunTime/this.introLinesDuration < .1){
                this.introLines.children[0].material.opacity = (this.totalRunTime/this.introLinesDuration) * (1 / .1) - .2;
            }if(this.totalRunTime/this.introLinesDuration > .8){
                this.introLines.children[0].material.opacity = Math.max(1-this.totalRunTime/this.introLinesDuration,0) * (1 / .2);
            }
            this.introLines.rotateY((2 * Math.PI)/(this.introLinesDuration/renderTime));
        } else if(this.introLines){
            this.scene.remove(this.introLines);
            delete[this.introLines];
        }

        // do the shaders

        // this.smokeUniforms.currentTime.value = this.totalRunTime;
        this.pointUniforms.currentTime.value = this.totalRunTime;

        this.smokeProvider.tick(this.totalRunTime);

        // updateSatellites.call(this, renderTime);
        this.camera.lookAt( this.scene.position );
        this.renderer.render( this.scene, this.camera );

    }

    return Globe;

})(THREE, TWEEN, document);

ENCOM.Globe = Globe; return ENCOM;

})(ENCOM || {}, THREE, document);