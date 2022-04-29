module.exports = function (grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    watch: {
      options: {
        livereload: true
      },
      tasks: ['browserify'],
      files: [
        'src/js/*.js',
        'demo1.html',
        'demo2.html',
        'demo3.html',
        'Gruntfile.js',
        'browserify.js'
      ]
    },
    browserify: {
      'dist/<%= pkg.name %>.js': ['browserify.js']
    },
    uglify: {
      main: {
        files: {
          'dist/<%= pkg.name%>.min.js': 'dist/<%= pkg.name %>.js'
        }
      }
    }
  })

  grunt.loadNpmTasks('grunt-contrib-watch')
  grunt.loadNpmTasks('grunt-browserify')
  grunt.loadNpmTasks('grunt-contrib-uglify')

  grunt.registerTask('build', ['browserify', 'uglify'])
}
