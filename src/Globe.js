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
