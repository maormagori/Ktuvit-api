# Ktuvit.me API

Ktuvit is a community based site for hebrew subtitles. It was previously known as Screwzira and was hosted under the same name. Ever since ktuvit moved to a new domain they decided to close their API and calls to bring it back were unanswered.
Recently I built a project and needed a quick access to Ktuvit's database so I built this API.

**Disclaimer:** I called it an API but we don't really have direct access to the database. It works by making the same requests a user using the site would and extracting the results from the HTML at times.

**Disclaimer:** I'm by no means affiliated or am a part of Ktuvit. If this project breaks the site's TOS, reach out to me and I will terminate it.

## Installation

Install the API using npm:

```bash
npm i ktuvit-api
```

## Usage

This [API](./API.md) let's you interact with Ktuvit.me subtitles database directly from node. With this module you can search, get a movie's Ktuvit Id, get a movie's subtitle list, download subtitles and more.

### You can learn more about the API *[here!](./API.md)*

### Examples
here we are downloading the first subtitle for "Pulp Fiction" and saving it locally:

```javascript
const KtuvitManager = require('ktuvit-api');
const fs = require('fs');

const manager = new ktuvitManager('u=###&g=###');

const pulpFictionKtuvitID = await manager.getKtuvitID({imdbId: 'tt0110912', name: 'Pulp Fiction'});

const firstSub = await manager.getSubsIDsListMovie(pulpFictionKtuvitID)[0];

manager.downloadSubtitle(pulpFictionKtuvitID, firstSub.id, function(buffer){
  fs.writeFile('pulp-fiction.srt', buffer, function (err) {
      if (err) return console.log(err);
      console.log('SRT is ready!');
      });
});

```

## Contributing
Since I've built this API for my needs and in a rush it's probably lacking a lot of features so pull requests are very welcomed! If you found a bug please open an issue.

## TODO
Feel free to help with these:
- [x] Cache system
- [ ] Better error handling.
- [x] Add documentation.
- [ ] Translate the readme.
## License
[MIT](https://choosealicense.com/licenses/mit/)
