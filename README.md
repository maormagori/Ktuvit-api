# Ktuvit.me API

Ktuvit is a community based site for hebrew subtitles. It was previously known as Screwzira and was hosted under the same name. Ever since ktuvit moved to a new domain they decided to close their API and calls to bring it back were unanswered.
Recently I built a project and needed a quick access to Ktuvit's database so I built this API.

**Disclaimer:**I called it an API but we don't really have direct access to the database. It works by making the same requests a user using the site would and extracting the results from the HTML at times.

**Disclaimer:** I'm by no means affiliated or am a part of Ktuvit. If this project breaks the site's TOS, reach out to me and I will terminate it.

## Installation

Install the API using npm:

```bash
npm i ktuvit-api
```

## Usage

### Initialization
To initialize the manager you need the user's 'Login' cookie. You can use the manager's function getLoginCookie() if you don't have it.

```javascript
const ktuvitManager = require('ktuvit-api');

const loginCookie = "u=####g=####";
const manager = new ktuvitManager(loginCookie);
```
Atm there is no validation on the login cookie. Future versions might add multiple users per manager.

#### `getLoginCookie(Email, hashedPassword)`
If you don't want to build a cookie jar you can use the manager's `getLoginCookie(Email, hashedPassword)`. 

Email - the user's email.
hashedPassword - the user's hashed password.

```javascript
const ktuvitManager = require('ktuvit-api');

const loginCookie = await ktuvitManager.getLoginCookie("email", "hashedPass");
const manager = new ktuvitManager(loginCookie);

//This works too
const manager = new ktuvitManager(await ktuvitManager.getLoginCookie("email", "hashedPass"));
```
### Ktuvit title ID
To get the subtitle list for a title or download a sub you must have the title's Ktuvit ID. There a few ways to get a title's ktuvit ID using the manager. let's start with the fastest.

#### `getKtuvitID(item)`

The manager provides the `getKtuvitID(item)` for a fast and simple way to get the Ktuvit ID back. **You can only use this function if you have the title's Imdb ID**, just the title name is not enough.
The fastest way to use it is by providing the IMDB id of the title and the title's name **in the way Ktuvit stores it.**
```javascript
const pulpFictionKtuvitID = await manager.getKtuvitID({imdbId: 'tt0110912', name: 'Pulp Fiction'});

console.log(pulpFictionKtuvitID) //Prints: 34C337572B6C5626B9352ABCB3CCDA45
```

Since ktuvit is maintained by the community we sometimes get a mismatch between the title's actual spelling and the way it's spelled on Ktuvit.
You can still use the function with just the IMDB id of the title but note that this takes more time since it calls IMDb to get the title's name.

```javascript
const pulpFictionKtuvitID = await manager.getKtuvitID({imdbId: 'tt0110912'});

console.log(pulpFictionKtuvitID) //Prints: 34C337572B6C5626B9352ABCB3CCDA45
```

#### `searchKtuvit(item)`
If you don't have the title's IMDb id you're just gonna have to search the title on Ktuvit and choose yourself. The search function accepts an `item` object:
```javascript
//item example
{
    name: "ספרות זולה",  //Title's name
    actors: ["69344"],  //Array of actors Ktuvit's id
    studios: null,  //Not usable yet. keep null.
    directors: ["15820"],  //Array of directors Ktuvit's id
    genres: ["9","16","22"], //Array of genres Ktuvit's id
    countries: ["14","13","223"],  //Array of countries Ktuvit's id
    languages: ["1","155","170"],  //Array of languages Ktuvit's id
    year: "2018",  //The title's release year in string. A range string is also accepted.
    rating: ["2","3","4"],  //Array of ratings from 0-9
    type: "movie",  //String movie|series
    withSubsOnly: false  //Boolean true|false
}
```
The item can be empty or contain only one of the values. As an advice you should avoid using anything besides name, type, year and withSubsOnly.
The function returns an array of results from Ktuvit:

```javascript
const pulpFictionResults = await manager.searchKtuvit({name:'pulp fiction'});

//pulpFictionResults will look like:
[
  {
    ID: '34C337572B6C5626B9352ABCB3CCDA45',
    HebName: 'ספרות זולה',
    EngName: 'Pulp Fiction',
    IMDB_Link: 'http://www.imdb.com/title/tt0110912',
    ReleaseDate: 1994,
    FilmRunTimeMinutes: 154,
    Summary: '',
    FolderID: '52281b55-02e8-4684-bf54-95c715cc8348',
    CreateDate: '2017-10-03T03:00:05.567',
    Rating: 8.9,
    NumberOfVoters: 1490828,
    NumOfSubs: 64,
    FilmImage: null,
    UrlParam: null,
    Actors: "ברוס וויליס, אומה תורמן, סמואל ל. ג'קסון, ג'ון טרבולטה, לורנס בנדר, דוד ווסקו",
    Countries: null,
    Directors: 'קוונטין טרנטינו',
    Genres: 'דרמה, פשע',
    Languages: null,
    Studios: null,
    IsSeries: false,
    ImdbID: 'tt0110912'
  }
]
```
From here you can iterate through the array, find the title you want and extract the `ID` field and that's your Ktuvit ID.

### Ktuvit sub ID
From now on a title's Ktuvit ID will be called `ktuvitId` and a subtitle's Ktuvit ID will be called `subId`.
If you have a title's ktuvitId you can fetch it's subtitles using these functions based on whether it's a movie or a series' episode respectively

#### `getSubsIDsListMovie(ktuvitID)`
#### `getSubsIDsListEpisode(ktuvitID, season, episode)`

Both these functions will return an array of `subtitle object` for example:

```javascript
const pulpFictionsSubtitles = await manager.getSubsIDsListMovie('34C337572B6C5626B9352ABCB3CCDA45');

const friendsFirstEpisodeSubs = await manager.getSubsIDsListMovie('7C1B6B0897EA6E819781158935199C8E', 1, 1);

//Subtitle object example
{
    subName: 'Pulp.Fiction.1994.720p.BluRay.DTS.x264-ViGi',  //File name as a String.
    id: 'E100454053EDCCB2F625385144036836', //The sub's subId as a String.
    downloads: 553, //amount of times the sub was download as a Number.
    uploadDate: 2017-11-21T00:00:00.000Z,  //Date object for when the sub was uploaded.
    size: '154.39 KB',  //File size as a string.
    fileType: 'srt',  //Sub's file format as a String.
    credit: 'תרגום: אלמוני'  //The credit's section from Ktuvit website as a String.
  }
```
### Downloading subtitles
#### `downloadSubtitle(KtuvitId, subId, callback)`
Now that you have both the `KtuvitId` and the `subId` you can download the sub. The download function third argument is a callback function with `buffer` as the first argument. 
For example:

```javascript
//Printing the srt
manager.downloadSubtitle('34C337572B6C5626B9352ABCB3CCDA45',
    'E100454053EDCCB2F625385144036836',
    function(buffer){ console.log(buffer)});

//Saving it locally
const fs = require('fs');

manager.downloadSubtitle('34C337572B6C5626B9352ABCB3CCDA45',
    'E100454053EDCCB2F625385144036836',
    function(buffer){ 
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
- [ ] Better error handling.
- [ ] Add documentation.
- [ ] Translate the readme.
## License
[MIT](https://choosealicense.com/licenses/mit/)
