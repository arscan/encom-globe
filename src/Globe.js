var Globe = (function(THREE, TWEEN, document){

    var latLonToXYZ = function(width, height, lat,lon){

        var x = Math.floor(width/2.0 + (width/360.0)*lon);
        var y = Math.floor(height - (height/2.0 + (height/180.0)*lat));

        return {x: x, y:y};
    };

    var latLon2d = function(lat,lon){

        var rad = 2 + (Math.abs(lat)/90) * 15;
        return {x: lat+90, y:lon + 180, rad: rad};
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
        this.pins = [];
        this.satelliteAnimations = [];
        this.satelliteMeshes = [];
        this.satellites = {};
        this.quadtree = new Quadtree2(new Vec2(180, 360), 5);

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
            maxPins: 1000,
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
            this.data[i].when = this.introLinesDuration*((180+this.data[i].lng)/360.0) + 500; 
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

                    createParticles.call(_this);

                    cb();
                }

            }
        };

        img.addEventListener('load', registerCallback());

        img.src = this.mapUrl;
    };

    Globe.prototype.addPin = function(lat, lon, text){

        lat = parseFloat(lat);
        lon = parseFloat(lon);

        var altitude = 1.2;

        if(typeof text != "string" || text.length === 0){
            altitude -= Math.random() * .1;
        } else {
           altitude -= Math.random() * .1;
        }

        var pin = new Pin(lat, lon, text, altitude, this.scene, this.smokeProvider);

        this.pins.push(pin);

        // lets add quadtree stuff
        
        var pos = latLon2d(lat, lon);

        pin.pos_ = new Vec2(parseInt(pos.x),parseInt(pos.y)); 

        if(text.length > 0){
            pin.rad_ = pos.rad;
        } else {
            pin.rad_ = 1;
        }

        this.quadtree.addObject(pin);

        if(text.length > 0){
            var collisions = this.quadtree.getCollisionsForObject(pin);
            var collisionCount = 0;
            var tooYoungCount = 0;
            var hidePins = [];

            for(var i in collisions){
                if(collisions[i].text.length > 0){
                    collisionCount++;
                    if(collisions[i].age() > 5000){
                        hidePins.push(collisions[i]);
                    } else {
                        tooYoungCount++;
                    }
                }
            }

            if(collisionCount > 0 && tooYoungCount == 0){
                for(var i = 0; i< hidePins.length; i++){
                    hidePins[i].hideLabel();
                    hidePins[i].hideSmoke();
                    hidePins[i].hideTop();
                }
            } else if (collisionCount > 0){
                pin.hideLabel();
                pin.hideSmoke();
                pin.hideTop();
            }
        }

        if(this.pins.length > this.maxPins){
            var oldPin = this.pins.shift();
            this.quadtree.removeObject(oldPin);
            oldPin.remove();

        }

        return pin;

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
