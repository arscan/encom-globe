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

    var Pin = function(lat, lon, text, altitude, scene, _opts){

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

        var lineGeometry,
           lineMaterial,
           labelCanvas,
           labelTexture,
           labelMaterial,
           labelSprite,
           topTexture,
           topMaterial,
           topSprite,
           point,
           line;

        this.lat = lat;
        this.lon = lon;
        this.text = text;
        this.altitude = altitude;
        this.scene = scene;

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

        lineGeometry = new THREE.Geometry();
        lineMaterial = new THREE.LineBasicMaterial({
            color: opts.lineColor,
            linewidth: opts.lineWidth
        });

        point = mapPoint(lat,lon);

        lineGeometry.vertices.push(new THREE.Vector3(point.x, point.y, point.z));
        lineGeometry.vertices.push(new THREE.Vector3(point.x, point.y, point.z));
        line = new THREE.Line(lineGeometry, lineMaterial);

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

       labelSprite = new THREE.Sprite(labelMaterial);
       labelSprite.position = {x: point.x*altitude*1.1, y: point.y*altitude + (point.y < 0 ? -15 : 30), z: point.z*altitude*1.1};
       labelSprite.scale.set(labelCanvas.width, labelCanvas.height);

       /* the top */

       topTexture = new THREE.Texture(createTopCanvas(opts.topColor));
       topTexture.needsUpdate = true;
       topMaterial = new THREE.SpriteMaterial({map: topTexture, depthTest: false, fog: true, opacity: 0});
       topSprite = new THREE.Sprite(topMaterial);
       topSprite.scale.set(20, 20);
       topSprite.position.set(point.x * altitude, point.y * altitude, point.z * altitude);

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

        new TWEEN.Tween(point)
            .to( {x: point.x*altitude, y: point.y*altitude, z: point.z*altitude}, 1500 )
            .easing( TWEEN.Easing.Elastic.InOut )
            .onUpdate(function(){
                lineGeometry.vertices[1].x = this.x;
                lineGeometry.vertices[1].y = this.y;
                lineGeometry.vertices[1].z = this.z;
                lineGeometry.verticesNeedUpdate = true;
            }).start();

        /* add to scene */

        this.scene.add(labelSprite);
        this.scene.add(line);
        this.scene.add(topSprite);

        // line._globe_multiplier = 1.2; // if normal line, make it 1.2 times the radius in orbit

        // var existingMarkers = findNearbyMarkers.call(_this, lat, lon);
        // var allOld = true;
        // for(var i = 0; i< existingMarkers.length; i++){
        //     if(Date.now() - existingMarkers[i].creationDate < 10000){
        //         allOld = false;
        //     }
        // }
        // this.markerIndex[lat + "-" + lon] = true;

        /*
        if(existingMarkers.length == 0 || allOld){
            // get rid of old ones

            for(var i = 0; i< existingMarkers.length; i++){
                removeMarker.call(this, existingMarkers[i]);
            }

            // create the new one

            var textSprite = createLabel.call(this,text, point.x*1.18, point.y*1.18, point.z*1.18, 18, "#fff", this.font);
            this.scene.add(textSprite);

            var markerTopMaterial = new THREE.SpriteMaterial({map: _this.markerTopTexture, color: 0xFD7D8, depthTest: false, fog: true, opacity: text.length > 0});
            var markerTopSprite = new THREE.Sprite(markerTopMaterial);
            markerTopSprite.scale.set(15, 15);
            markerTopSprite.position.set(point.x*1.2, point.y*1.2, point.z*1.2);


            var startSmokeIndex = _this.smokeIndex;

            for(var i = 0; i< 30; i++){
                _this.smokeParticleGeometry.vertices[_this.smokeIndex].set(point.x * 1.2, point.y * 1.2, point.z * 1.2);
                _this.smokeParticleGeometry.verticesNeedUpdate = true;
                _this.smokeAttributes.myStartTime.value[_this.smokeIndex] = _this.totalRunTime + (i*50 + 1500);
                _this.smokeAttributes.myStartLat.value[_this.smokeIndex] = lat;
                _this.smokeAttributes.myStartLon.value[_this.smokeIndex] = lon;
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
                latlon: lat + "-" + lon
            };

            this.markers.push(m);

            registerMarker.call(_this,m, lat, lon);

            setTimeout(function(){
                _this.scene.add(markerTopSprite);
            }, 1500)

        } else {
            line._globe_multiplier = 1 + (.05 + Math.random() * .15); // randomize how far out
            this.quills.push({
                line: line,
                latlon: lat + "-" + lon
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
       */


    };

    Pin.prototype.toString = function(){
        return "" + this.lat + "_" + this.lon;
    }

    Pin.prototype.changeAltitude = function(newAltitude){


    };

    Pin.prototype.hideTop = function(){

    };

    Pin.prototype.hideLabel = function(){

    };

    Pin.prototype.hideSmoke = function(){


    };

    return Pin;

})(THREE, TWEEN, document);
