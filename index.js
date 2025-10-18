//
// florence, a framework for interacting with Last.fm
// Copyright (c) 2025 katelyn and contributors
// Licensed under GPLv3
//

import esbuild from 'esbuild';

esbuild
    .build({
        entryPoints: ['src/index.js'],
        bundle: true,
        outfile: 'dist/florence.js',
        minify: false,
        platform: 'browser',
        format: 'esm'
    })
    .catch(() => process.exit(1));
