const gulp = require('gulp');
const ts = require('gulp-typescript');
const sourcemaps = require('gulp-sourcemaps');

const spawn = require('child_process').spawn;
const ASSETS = ['src/**/*.json', 'src/**/*.json', 'package.json'];

const DEST = 'dist';

var server = null;

// pull in the project TypeScript config
const tsProject = ts.createProject('./tsconfig.json');

function devBuild() {
  const tsResult = tsProject.src()
    .pipe(sourcemaps.init({ debug: true }))
    .pipe(tsProject());
  return tsResult.js
    .pipe(sourcemaps.mapSources(function (sourcePath, file) {
      // source paths are prefixed with '../src/'
      
      return sourcePath.slice(1);
    }))
    .pipe(sourcemaps.write('.', { includeContent: false, sourceRoot: function (file) { return file.cwd + '/src/'; } }))
    .pipe(gulp.dest(DEST));
}


function prodBuild() {
  const tsResult = tsProject.src()
    .pipe(sourcemaps.init())
    .pipe(tsProject());
  return tsResult.js
    .pipe(gulp.dest(DEST));
}

function assets() {
  return gulp.src(ASSETS).pipe(gulp.dest(DEST));
}


function watch(done) {
  gulp.watch(['./src/**/*.ts', './src/**/*.json'], gulp.series(gulp.parallel(devBuild, assets), makeRunServer('test')));
  done();
}

function makeRunServer(target){
  return (done)=>{
    if (server) {
      server.once('exit', () => { done(); })
      server.kill('SIGTERM');
    }
    server = spawn('yarn', ['run', target], { stdio: 'inherit' });
    server.on('close', function (code) {
      if (code > 0) {
        console.log('Error detected, waiting for changes...');
      }
    });
    done();
  }
}

// function runServer(done) {

// }


gulp.task('default', gulp.series(
  // 'upgradePKG', 
  devBuild,
  assets));
gulp.task('prod', gulp.series(prodBuild, assets));
gulp.task('watch', gulp.series(devBuild, assets, makeRunServer('test'), watch));
gulp.task('debug', gulp.series(devBuild, assets, makeRunServer('debug')));