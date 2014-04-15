module.exports = function(grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
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
        shell: {
            buildgrid: {
                command: "bin/buildgrid -r 500 -o grid.js -m resources/equirectangle_projection.png"
            }
        }

    });


    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-shell');
    grunt.loadNpmTasks('grunt-browserify');

    grunt.registerTask('buildgrid', ['shell:buildgrid']);


};
