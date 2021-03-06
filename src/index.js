import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import glob from 'glob';

import 'zone.js/dist/zone-node';
import { renderModuleFactory } from '@angular/platform-server';

const TMPFILE = './temp.js';

export default class StarFishCommandSSr {
  constructor() {
    this.name = 'ssr';
    this.type = 'command';
  }

  getName() {
    return this.name;
  }

  run(inputs, flags) {
    const inputPath = path.join(inputs[0]);

    if (!fs.statSync(inputPath).isDirectory()) {
      throw new Error('input path is not a directory');
    }
    if (!fs.statSync(path.join(inputPath, 'config.yaml')).isFile()) {
      throw new Error('config.yaml file not found');
    }

    // TODO configure 应该从主程序读入-> 传入constructor
    const starfishConfigure = yaml.safeLoad(
      fs.readFileSync(path.join(inputPath, 'config.yaml'), 'utf-8')
    );
    const themePath = path.join(
      inputPath,
      starfishConfigure.STYLE.THEMEDIR,
      starfishConfigure.STYLE.THEME
    );

    const ngFactoryFilePath = fs
      .readdirSync(path.join(themePath, './dist-server/'))
      .filter(name => /^main.+.bundle.js$/.test(name))[0];

    fs.writeFileSync(
      path.join(__dirname, TMPFILE),
      fs.readFileSync(path.join(themePath, './dist-server/', ngFactoryFilePath), 'utf-8'),
      'utf-8'
    );
    const AppServerModuleNgFactory = require(TMPFILE).AppServerModuleNgFactory;

    const buildedPath = path.join('.', 'build');

    const ignoreRegExp = new RegExp(
      starfishConfigure.SSR.IGNORE.map(regex => new RegExp(regex).source).join('|')
    );

    glob(path.join(buildedPath, '**/*.html'), function(err, files) {
      files
        .filter(file => {
          return !ignoreRegExp.test(file.replace(/^build/, ''));
        })
        .forEach(file => {
          const url = file.split(buildedPath)[1];
          renderModuleFactory(AppServerModuleNgFactory, {
            document: fs.readFileSync(file, 'utf-8'),
            url: url
          }).then(html => {
            fs.writeFileSync(path.join(buildedPath, url), html, 'utf-8');
          });
        });

      fs.unlinkSync(path.join(__dirname, TMPFILE));
    });
  }
}
