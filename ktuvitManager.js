const superagent = require("superagent")
    require('superagent-charset')(superagent),
    jsdom = require('jsdom'),
    imdb2name = require('name-to-imdb');


// TODO: add error handling everywhere.
class KtuvitManager {
    
    static BASE_URL = "https://www.ktuvit.me/";
    static KTUVIT = {
        SEARCH_URL: this.BASE_URL + "Services/ContentProvider.svc/SearchPage_search",
        MOVIE_INFO_URL: this.BASE_URL + "MovieInfo.aspx?ID=",
        EPISODE_INFO_URL: this.BASE_URL + "Services/GetModuleAjax.ashx?",
        REQUEST_DOWNLOAD_IDENTIFIER_URL: this.BASE_URL + "Services/ContentProvider.svc/RequestSubtitleDownload",
        DOWNLOAD_SUB_URL: this.BASE_URL + "Services/DownloadFile.ashx?DownloadIdentifier=",
        LOGIN_URL: this.BASE_URL + "Services/MembershipService.svc/Login"
    };


    constructor(loginCookie){
        
        this.loginCookie = loginCookie;
        this.headers = {
            "accept": "application/json, text/javascript, */*; q=0.01",
            "cookie": `Login=${this.loginCookie}`
        }
    }
    
    static async getLoginCookie(email, hashedPass) {
        return superagent.post(this.KTUVIT.LOGIN_URL)
            .send({"request" :{Email:email , Password:hashedPass}}).then(res => {
                //Parsing the cookie as a string because a cookie parser would be
                // an extra dependency for an edge case. 
                return res.headers['set-cookie'][1].split(';')[0].replace('Login=','')
            });
    }

    validateCookie(){
        //TODO: add a validator.
    }

    postWithLoginInfo(link, data){
        return new Promise((resolve, reject)=>{
            superagent.post(link)
            .withCredentials()
            .set(this.headers)
            .send({"request" :data})
            .then((res) => { resolve(res)})
            .catch((err) => {reject(err)})
        })
    }

    getWithLoginInfo(link){
        return new Promise((resolve, reject)=>{
            superagent.get(link)
            .withCredentials()
            //.timeout({deadline: 6000})
            .set(this.headers)
            .then((res) => { resolve(res)})
            .catch((err) => {reject(err)})
        })
    }

    async searchKtuvit(item){
        const query = {"FilmName": item.name || "",
                    "Actors": item.actors || [],
                    "Studios": item.studios || null,
                    "Directors": item.directors || [],
                    "Genres": item.genres || [],
                    "Countries": item.countries || [],
                    "Languages": item.languages || [],
                    "Year": item.year === undefined ? "":`${item.year}`.split("–")[0],
                    "Rating": item.rating || [],
                    "Page": 1,
                    "SearchType": item.type === undefined ? "-1":(item.type == "movie" ? "0":"1"),
                    "WithSubsOnly": item.withSubsOnly || false
        };

        try{
            let res = await this.postWithLoginInfo(KtuvitManager.KTUVIT.SEARCH_URL,query);
            // console.log(res);
            const parsedData = JSON.parse(res.body.d);
            if(parsedData.ErrorMessage == "" || parsedData.ErrorMessage == null)
                return JSON.parse(res.body.d).Films;
            else{
                throw new Error("Incorrect search Values");
            }
        } catch (err) {
            if(err.message == "Incorrect search Values"){
                console.log('search query: \n', query)
                throw err;
            }
            else{
                console.error('agent error. Please use validateCookie() to make sure your cookie works.')
                throw err;
            }
        }
        
    }

    /**
     * 
     * @param {Object} item      The title to search. includes: name, year, type, imdbId. All strings.
     */
    async getKtuvitID(item){

        if (item.imdbId === undefined)
            throw new Error('imdbId not provided.')
        
        //For some reason id based search doesn't work in ktuvit so we fetch the name from Imdb.
        if (item.name === undefined){
            await imdb2name(item.imdbId, function (err, res, inf){
                if(err)
                    throw err;
                item.name = inf.meta.name;
            })
        }

        try{
            return this.findIDInResults(await this.searchKtuvit(item),item.imdbId);
        }
        catch (err) {
            return null;
        }
        

    }

    findIDInResults(films, imdbId){

        return films.find(title => title.ImdbID == imdbId).ID;
    }

    async getSubsIDsListEpisode(ktuvitID, season, episode){
        
        //bulding the query. A simple query builder string.
        var query_string = `moduleName=SubtitlesList&SeriesID=${ktuvitID}&Season=${season}&Episode=${episode}`

        var res = await this.getWithLoginInfo(KtuvitManager.KTUVIT.EPISODE_INFO_URL+query_string);
        console.log(res.data);
        var subtitlesIDs = this.extractSubsFromHtml(res.text);
        //console.log(subtitlesIDs);
        return subtitlesIDs || [];

    }

    async getSubsIDsListMovie(ktuvitID){
        var res = await this.getWithLoginInfo(this.KTUVIT.MOVIE_INFO_URL+ktuvitID);
        var subtitlesIDs = this.extractSubsFromHtml(res.text);
        return subtitlesIDs || [];
    }

    extractSubsFromHtml(html) {
        //The episode html only contains the subtitle rows and since I built this function
        //for the movie's html so I need to add the missing information.
        html = html.includes('<!DOCTYPE html>') ? html:`<!DOCTYPE html><table id="subtitlesList"><thead><tr/></thead>${html}</table>`

        var dummyDom = new jsdom.JSDOM(html).window;
        var subtitlesListElement = dummyDom.document.getElementById('subtitlesList');
        subtitlesListElement = [...subtitlesListElement.rows];
        subtitlesListElement.shift();
        //console.log(subtitlesListElement.length);
        var subtitlesIDs = subtitlesListElement.map((sub) => {
            //Getting sub's file name from html.
            //I don't care it's this way, it works.
            //I never learned jquery so don't judge me.
            let subName = sub.cells[0].querySelector("div").innerHTML.split('<br>')[0];
            
            //trimming sub's name
            subName = subName.trim();

            //Getting the sub's ktuvit id.
            let id  = sub.cells[5].firstElementChild.getAttribute('data-subtitle-id');

            //Amount of times the sub has been downloaded.
            let downloads = parseInt(sub.cells[4].innerHTML);

            //The sub file's upload date.
            let uploadDate = new Date(sub.cells[3].innerHTML.split('/').reverse().join('-'));
            
            //The sub file size.
            let size = sub.cells[2].innerHTML;

            //Sub's file type.
            let fileType = sub.cells[1].innerHTML;

            //The sub creator
            let credit = sub.cells[0].querySelector("div > small").innerHTML;

            return {subName: subName,
                id: id,
                downloads: downloads,
                uploadDate: uploadDate,
                size: size,
                fileType: fileType,
                credit: credit
            };
        });

        return subtitlesIDs;
    }

    async downloadSubtitle(KtuvitId, subId, cb){
        const downloadIdentifierRequest = {
            "FilmID": KtuvitId,
            "SubtitleID": subId,
            "FontSize": 0,
            "FontColor": "",
            "PredefinedLayout": -1
        };

        let downloadIdentifier = await this.postWithLoginInfo(this.KTUVIT.REQUEST_DOWNLOAD_IDENTIFIER_URL,downloadIdentifierRequest);
        downloadIdentifier = JSON.parse(downloadIdentifier.body.d).DownloadIdentifier
        
        await superagent.get(this.KTUVIT.DOWNLOAD_SUB_URL + downloadIdentifier)
            .charset('ISO-8859-8')
            .withCredentials()
            .set(this.headers)
            .buffer(true)
            .then(res => {cb(res.text)})
            .catch(err => err)
    }
}

var manager = new KtuvitManager('u=7CA271EC2204B13FAE3F3CFE9D24F3AC&g=3B82622A00E8D3D24F982498638320F48803A3A8CED4220DEDCFBE2A06219528853A8A8AFC7589346C15A2979E58EC07');
manager.getSubsIDsListEpisode('008C29A60AE0CC5D6A082E4195676FC0', 6,7);