
var { emptyDirSync } = require('fs-extra');
var exec = require('child_process').exec;

exec('git add -f dist', (e, stdout, stderr) => {

  console.log('Added dist files');

  if(e) {
    console.log(stdout, stderr);
    console.error(e);
    process.exit(0);
  }

  exec('git commit dist/* -m "evennode dist"', (e, stdout, stderr) => {

    console.log('Committed dist files');

    if(e) {
      console.log(stdout, stderr);
      console.error(e);
      process.exit(0);
    }

    exec('git push -f evennode master', (e, stdout, stderr) => {

      console.log('Pushed dist files');

      if(e) {
        console.log(stdout, stderr);
        console.error(e);
        process.exit(0);
      }

      exec('git reset --hard HEAD~1', (e, stdout, stderr) => {

        console.log('Reset dist files');

        if(e) {
          console.log(stdout, stderr);
          console.error(e);
          process.exit(0);
        }

        emptyDirSync('dist');
      });
    });
  });
});
