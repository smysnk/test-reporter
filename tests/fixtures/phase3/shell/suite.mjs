process.stdout.write('shell fixture start\n');
process.stdout.write('tests 3 | pass 2 | fail 1 | skip 0\n');
process.stderr.write('simulated shell failure\n');
process.exit(1);
