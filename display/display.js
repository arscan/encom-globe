var globe;

function createGlobe(){

  globe = new ENCOM.Globe(window.innerWidth, window.innerHeight, {
    data: data, // from the display-data.js
    tiles: grid.tiles
  });

  globe.setClickHandler(function(id){
      alert(id);
  });

  // var defaults = {
  //   font: "Inconsolata",
  //   baseColor: "#ffcc00",
  //   markerColor: "#ffcc00",
  //   pinColor: "#00eeee",
  //   satelliteColor: "#ff0000",
  //   introLinesAltitude: 1.10,
  //   introLinesDuration: 2000,
  //   introLinesColor: "#8FD8D8",
  //   introLinesCount: 60,
  //   scale: 1.0, // set to lower if you want the globe to be smaller
  //   dayLength: 28000, // set to 0 if you don't want it to spin
  //   maxPins: 500,
  //   maxMarkers: 4,
  //   data: [],
  //   tiles: [],
  //   viewAngle: .1, // North-South camera angle; between -Math.PI and Math.PI
  //   cameraAngle: Math.PI // East-West camera angle; between -Math.PI and Math.PI
  // };

  $("#globe").append(globe.domElement);

  /* add some satellites in 4 seconds */
  setTimeout(function(){
    var constellation = [];
    var alt =  parseFloat($("#globe-sa").val());
    var opts = {
      coreColor: "#ff0000",
      numWaves: 8
    };

    for(var i = 0; i< 2; i++){
      for(var j = 0; j< 3; j++){
        constellation.push({
          lat: 50 * i - 30 + 15 * Math.random(), 
          lon: 120 * j - 120 + 30 * i,
          altitude: 1.3
        });
      }
    }

    globe.addConstellation(constellation, opts);
  }, 4000);

  /* add some of the yellow markers in 2 seconds */
  /* probably should be taken out, but left in in case worth being repurposed */
  setTimeout(function(){
      globe.addMarker(49.25, -123.1, "Vancouver");
      globe.addMarker(35.6895, 129.69171, "Tokyo", true);
  }, 2000);

  function animate(){
    globe.tick();
    requestAnimationFrame(animate);
  }

  globe.init(animate);
}

/* web font stuff*/
var wf = document.createElement('script');
wf.src = ('https:' == document.location.protocol ? 'https' : 'http') +
  '://ajax.googleapis.com/ajax/libs/webfont/1.4.7/webfont.js';
wf.type = 'text/javascript';
wf.async = 'true';
var s = document.getElementsByTagName('script')[0];
s.parentNode.insertBefore(wf, s);

WebFontConfig = {
  google: {
    families: ['Inconsolata']
  },
  active: function(){
    createGlobe(); /* start the globe after the font is loaded */
  }
};
