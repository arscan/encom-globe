var THREE = require('three');

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

module.exports = TextureAnimator;
