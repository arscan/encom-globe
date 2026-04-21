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
    "   vColor = vec4( color, opacity );",
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

    var opts = {
        smokeCount: 5000,
        smokePerPin: 30,
        smokePerSecond: 20
    };

    if(_opts){
        for(var i in opts){
            if(_opts[i] !== undefined){
                opts[i] = _opts[i];
            }
        }
    }

    this.opts = opts;

    var count = opts.smokeCount;

    this._myStartTime = new Float32Array(count);
    this._myStartLat  = new Float32Array(count);
    this._myStartLon  = new Float32Array(count);
    this._altitude    = new Float32Array(count);
    this._active      = new Float32Array(count);

    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',    new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute('myStartTime', new THREE.BufferAttribute(this._myStartTime, 1));
    geometry.setAttribute('myStartLat',  new THREE.BufferAttribute(this._myStartLat, 1));
    geometry.setAttribute('myStartLon',  new THREE.BufferAttribute(this._myStartLon, 1));
    geometry.setAttribute('altitude',    new THREE.BufferAttribute(this._altitude, 1));
    geometry.setAttribute('active',      new THREE.BufferAttribute(this._active, 1));

    this._geometry = geometry;

    this.uniforms = {
        currentTime: { type: 'f', value: 0.0 },
        color: { type: 'c', value: new THREE.Color("#aaa") }
    };

    var material = new THREE.ShaderMaterial({
        uniforms:       this.uniforms,
        vertexShader:   vertexShader,
        fragmentShader: fragmentShader,
        transparent:    true
    });

    this.smokeIndex = 0;
    this.totalRunTime = 0;

    scene.add(new THREE.Points(geometry, material));
};

SmokeProvider.prototype.setFire = function(lat, lon, altitude){

    var startSmokeIndex = this.smokeIndex;

    for(var i = 0; i < this.opts.smokePerPin; i++){
        var si = this.smokeIndex;
        this._myStartTime[si] = this.totalRunTime + (1000*i/this.opts.smokePerSecond + 1500);
        this._myStartLat[si]  = lat;
        this._myStartLon[si]  = lon;
        this._altitude[si]    = altitude;
        this._active[si]      = 1.0;

        this.smokeIndex++;
        this.smokeIndex = this.smokeIndex % this.opts.smokeCount;
    }

    this._geometry.getAttribute('myStartTime').needsUpdate = true;
    this._geometry.getAttribute('myStartLat').needsUpdate = true;
    this._geometry.getAttribute('myStartLon').needsUpdate = true;
    this._geometry.getAttribute('altitude').needsUpdate = true;
    this._geometry.getAttribute('active').needsUpdate = true;

    return startSmokeIndex;
};

SmokeProvider.prototype.extinguish = function(index){
    for(var i = 0; i < this.opts.smokePerPin; i++){
        this._active[(i + index) % this.opts.smokeCount] = 0.0;
    }
    this._geometry.getAttribute('active').needsUpdate = true;
};

SmokeProvider.prototype.changeAltitude = function(altitude, index){
    for(var i = 0; i < this.opts.smokePerPin; i++){
        this._altitude[(i + index) % this.opts.smokeCount] = altitude;
    }
    this._geometry.getAttribute('altitude').needsUpdate = true;
};

SmokeProvider.prototype.tick = function(totalRunTime){
    this.totalRunTime = totalRunTime;
    this.uniforms.currentTime.value = this.totalRunTime;
};

module.exports = SmokeProvider;
