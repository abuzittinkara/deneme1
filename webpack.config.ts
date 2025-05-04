/**
 * webpack.config.ts
 * Webpack yapılandırma dosyası
 */
import * as path from 'path';
import { Configuration } from 'webpack';

const config: Configuration = {
  mode: 'production',
  // Giriş (entry) => node_modules/mediasoup-client/lib/index.js
  entry: path.resolve(__dirname, 'node_modules', 'mediasoup-client', 'lib', 'index.js'),

  // Çıkış (output) => public/libs/mediasoup-client.min.js
  output: {
    path: path.resolve(__dirname, 'public', 'libs'),
    filename: 'mediasoup-client.min.js',

    // Burada eklediğimiz ayarlar:
    // library: 'mediasoupClient' => "mediasoupClient" isminde global değişken yaratır
    // libraryTarget: 'window'    => Bu global değişkeni window.mediasoupClient olarak ekler
    library: 'mediasoupClient',
    libraryTarget: 'window'
  }
};

export default config;
