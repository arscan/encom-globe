module.exports = function(grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        concat: {
            options: {
                separator: "\n",
                banner: ";var ENCOM = (function(ENCOM, THREE, document){\n\n",
                footer: "\nENCOM.Globe = Globe; return ENCOM;\n\n})(ENCOM || {}, THREE, document);"
            },
            dist: {
                src: [
                    'src/utils.js',
                    'src/TextureAnimator.js',
                    'src/Satellite.js',
                    'src/SmokeProvider.js',
                    'src/Pin.js',
                    'src/!(Globe).js',
                    'src/Globe.js'
                ],
                dest: 'build/<%= pkg.name %>.js'
            }
        },
        watch: {
            options: {
                livereload: true
            },
            tasks: ['browserify'],
            files: ['src/*.js', 'index.html', 'styles.css', 'Gruntfile.js', 'browserify.js']
        },
        browserify: {
            'build/<%= pkg.name %>.js': ['browserify.js']
        },
        copy: {
            main : {
                files: [
                {
                    src: 'bower_components/quadtree2/quadtree2.js',
                    dest: 'include/quadtree2.js'
                },
                {
                    src: 'bower_components/vec2/vec2.js',
                    dest: 'include/vec2.js'
                }]
            }
        },
        shell: {
            buildgrid: {
                command: "bin/buildgrid -r 500 -o grid.json"
            }
        }

    });


    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-shell');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-browserify');

    grunt.registerTask('buildgrid', ['shell:buildgrid']);


};
