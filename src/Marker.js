var THREE = require('three'),
    TWEEN = require('tween.js'),
    utils = require('./utils');

var createMarkerTexture = function(markerColor) {
    var markerWidth = 30,
        markerHeight = 30,
        canvas,
        texture;

    canvas =  utils.renderToCanvas(markerWidth, markerHeight, function(ctx){
        ctx.fillStyle=markerColor;
        ctx.strokeStyle=markerColor;
        ctx.lineWidth=3;
        ctx.beginPath();
        ctx.arc(markerWidth/2, markerHeight/2, markerWidth/3, 0, 2* Math.PI);
        ctx.stroke();

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
        lineSegments: 150
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

    
    point = utils.mapPoint(lat, lon);

    if(previous){
        previousPoint = utils.mapPoint(previous.lat, previous.lon);
    }

    if(!scene._encom_markerTexture){
        scene._encom_markerTexture = createMarkerTexture(this.opts.markerColor);
    }

    markerMaterial = new THREE.SpriteMaterial({map: scene._encom_markerTexture, opacity: .7, depthTest: true, fog: true});
    this.marker = new THREE.Sprite(markerMaterial);

    this.marker.scale.set(0, 0);
    this.marker.position.set(point.x * altitude, point.y * altitude, point.z * altitude);

    labelCanvas = utils.createLabel(text.toUpperCase(), this.opts.fontSize, this.opts.labelColor, this.opts.font, this.opts.markerColor);
    labelTexture = new THREE.Texture(labelCanvas);
    labelTexture.needsUpdate = true;

    labelMaterial = new THREE.SpriteMaterial({
        map : labelTexture,
        useScreenCoordinates: false,
        opacity: 0,
        depthTest: true,
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
        startPoint = utils.mapPoint(previous.lat,previous.lon);
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
                currentPoint = utils.mapPoint(nextSpot.lat, nextSpot.lon);

                currentVert2 = _this.geometrySplineDotted.vertices[x];
                currentPoint2 = utils.mapPoint(nextSpot2.lat, nextSpot2.lon);

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

module.exports = Marker;
