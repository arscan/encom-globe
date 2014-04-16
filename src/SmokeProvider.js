var THREE = require('three'),
    utils = require('./utils');

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
    "   gl_FragColor = vColor;", 
    "   float depth = gl_FragCoord.z / gl_FragCoord.w;",
    "   float fogFactor = smoothstep(1500.0, 1800.0, depth );",
    "   vec3 fogColor = vec3(0.0);",
    "   gl_FragColor = mix( vColor, vec4( fogColor, gl_FragColor.w), fogFactor );",

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

    var point = utils.mapPoint(lat, lon);

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

module.exports =  SmokeProvider;
