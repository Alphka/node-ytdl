<h1 align="center">node-ytdl</h1>

### Description
A youtube downloader that uses ytdl-core and ffmpeg.
Both video and audio are downloaded using the highest quality available

<hr>

### Usage

Using a video's url
```
node-ytdl [options] <url>
```

Searching for a video
```
node-ytdl [options] <search>
```

<hr>

### Supported options

```
Usage: node-ytdl [options] <string>

Arguments:
  string                                        Video's url or search

Options:
  -V, --version                                 Display program version
  -vn, --novideo                                Only downloads audio (default: false)
  -an, --noaudio                                Removes the audio from the video (default: false)
  -pn, --nopic                                  Downloads the audio without album art (default: false)
  -f, --format [mp4 | webm | mp3 | aac | opus]  Output format
  -o, --output [path]                           Output directory
  -y                                            Overwrite file (default: false)
  -th, --threads [number]                       Max CPU threads to be used
  -O, --open                                    Open file when finished (default: false)
  -r, --resolution <res>                        Choose video's resolution
  -h, --help                                    Display help
```

<hr>

### Installation

```
npm install
npm link
```
