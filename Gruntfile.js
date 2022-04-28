module.exports = function (grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON("package.json"),
    watch: {
      options: {
        livereload: true,
      },
      tasks: ["browserify"],
      files: [
        "src/*.js",
        "index.html",
        "styles.css",
        "Gruntfile.js",
        "browserify.js",
      ],
    },
    browserify: {
      "build/<%= pkg.name %>.js": ["browserify.js"],
    },
    uglify: {
      main: {
        files: {
          "build/<%= pkg.name%>.min.js": "build/<%= pkg.name %>.js",
        },
      },
    },
  });

  grunt.loadNpmTasks("grunt-contrib-watch");
  grunt.loadNpmTasks("grunt-browserify");
  grunt.loadNpmTasks("grunt-contrib-uglify");

  grunt.registerTask("build", ["browserify", "uglify"]);
};
