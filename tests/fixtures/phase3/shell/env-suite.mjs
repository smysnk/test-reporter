if (process.env.TEST_REPORTER_PHASE3_ENV !== 'enabled') {
  process.stderr.write(`Expected TEST_REPORTER_PHASE3_ENV=enabled but received ${process.env.TEST_REPORTER_PHASE3_ENV || '<missing>'}\n`);
  process.exit(1);
}

process.stdout.write('tests 1 | pass 1 | fail 0 | skip 0\n');
