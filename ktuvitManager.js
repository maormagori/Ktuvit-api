/**
 * @author Maor Magori
 * @copyright Maor Magori 2020
 * @license MIT
 */

// Importing notations
//      The request manager.
const superagent = require("superagent")
    // Hebrew chars encoding
    require('superagent-charset')(superagent),
    // HTML parser.
    jsdom = require('jsdom'),
    // converts IMDb id to name.
    imdb2name = require('name-to-imdb');

/**
 * Class that handles all the calls to Ktuvit.me
 */
class KtuvitManager {
    
    // Ktuvit's current address
    static BASE_URL = "https://www.ktuvit.me/";

    // Enum of used Ktuvit links.
    static KTUVIT = {
        SEARCH_URL: this.BASE_URL + "Services/ContentProvider.svc/SearchPage_search",
        MOVIE_INFO_URL: this.BASE_URL + "MovieInfo.aspx?ID=",
        EPISODE_INFO_URL: this.BASE_URL + "Services/GetModuleAjax.ashx?",
        REQUEST_DOWNLOAD_IDENTIFIER_URL: this.BASE_URL + "Services/ContentProvider.svc/RequestSubtitleDownload",
        DOWNLOAD_SUB_URL: this.BASE_URL + "Services/DownloadFile.ashx?DownloadIdentifier=",
        LOGIN_URL: this.BASE_URL + "Services/MembershipService.svc/Login"
    };

    /**
     * @constructor
     * @param {string} loginCookie User's login cookie's content from Ktuvit.
     */
    constructor(loginCookie){
        
        this.loginCookie = loginCookie;
        this.headers = {
            "accept": "application/json, text/javascript, */*; q=0.01",
            "cookie": `Login=${this.loginCookie}`
        }
        this.imdbCache = {};
    }
    
    /**
     * Use in case you don't have the user's login cookie.
     * @todo Add error for wrong credentials.
     * @returns The given user's login cookie
     * @param {string} email 
     * @param {string} hashedPass 
     */
    static async getLoginCookie(email, hashedPass) {
        return superagent.post(KtuvitManager.KTUVIT.LOGIN_URL)
            .send({"request" :{Email:email , Password:hashedPass}}).then(res => {
                //Parsing the cookie as a string because a cookie parser would be
                // an extra dependency for a single use. 
                return res.headers['set-cookie'][1].split(';')[0].replace('Login=','')
            });
    }

    /**
     * Use this to make sure your manager's cookie works.
     * @returns {true|false} true if cookie works, false otherwise. 
     */
    validateCookie(){
        //TODO: add a validator.
    }

    /**
     * Makes post calls with the user's cookie.
     * @param {string} link url
     * @param {string} data post data.
     * @returns {Promise} request promise
     */
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

    /**
     * Makes get calls with the user's cookie.
     * @param {string} link url
     * @returns {Promise} request promise
     */
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

    /**
     * Searches given arguments on ktuvit and returns results array.
     * As an advice you should avoid using anything besides name, type, year and withSubsOnly.
     * @typedef {object} Item
     * @property {string} name Title's name
     * @property {Array.<string>} actors actors names
     * @property {Array.<string>} directors directors names
     * @property {Array.<string>} genres title's geners
     * @property {Array.<string>} countries Title's origin countries
     * @property {Array.<string>} languages title's languages
     * @property {string} year relese year or series range
     * @property {Array.<string>} rating imdb ratings to include.
     * @property {movie|series} type Title's type
     * @property {true|false} withSubsOnly weather to show subless titles.
     * @property {string} imdbId Imdb id
     * @param {Item} item search parameters.
     * @returns {Array} results array
     */
    async searchKtuvit(item){
        // The search query
        const query = {"FilmName": item.name || "",
                    "Actors": item.actors || [],
                    "Studios": null,
                    "Directors": item.directors || [],
                    "Genres": item.genres || [],
                    "Countries": item.countries || [],
                    "Languages": item.languages || [],
                    "Year": item.year === undefined ? "":`${item.year}`.split("–")[0].trim(),
                    "Rating": item.rating || [],
                    "Page": 1,
                    "SearchType": item.type === undefined ? "-1":(item.type == "movie" ? "0":"1"),
                    "WithSubsOnly": item.withSubsOnly || false
        };

        try{
            let res = await this.postWithLoginInfo(KtuvitManager.KTUVIT.SEARCH_URL,query);
            const parsedData = JSON.parse(res.body.d);
            if(parsedData.ErrorMessage == "" || parsedData.ErrorMessage == null)
                return JSON.parse(res.body.d).Films;
            else{
                // The search query's arguments are wrong.
                throw new Error("Incorrect search Values");
            }
        } catch (err) {
            if(err.message == "Incorrect search Values"){
                console.log('search query: \n', query)
                throw err;
            }
            else{
                // Agent error
                console.error('agent error. Please use validateCookie() to make sure your cookie works.')
                throw err;
            }
        }
        
    }

    /**
     * Returns just the Ktuvit ID of a title's. Can only be used with imdbID.
     * @param {Item} item search Item
     * @returns {string|null} Ktuvit ID
     */
    async getKtuvitID(item){

        
        if (item.imdbId === undefined)
            throw new Error('imdbId not provided.')
        

        const getTitleName = (resolve, reject) => {
            //For some reason id based search doesn't work in ktuvit so we fetch the name from Imdb.
            if (item.name === undefined){
                imdb2name(item.imdbId, (err, res, inf) => {
                    if(err)
                        reject(err);
                    item.name = inf.meta.name;
                    resolve(item)
                })
            }
            else
                resolve(item)
        }

        if (this.imdbCache.hasOwnProperty(item.imdbId))
            return this.imdbCache[item.imdbId];
        
        let addTitleIfMissing = new Promise(getTitleName)
        return this.findIDInResults(await this.searchKtuvit(await addTitleIfMissing),item.imdbId);
        
    }

    /**
     * returns Ktuvit ID of a title based on it's imdbID from a results array.
     * @param {Array} films 
     * @param {string} imdbId 
     */
    findIDInResults(films, imdbId){
        try{
            const ktuvitId = films.find(title => title.ImdbID == imdbId).ID;
            this.imdbCache[imdbId] = ktuvitId;
            return ktuvitId;
        }
        catch (err){
            return null
        }
    }

    /**
     * return an array of subtitle object for a given episode's ktuvit id.
     * @param {string} ktuvitID Ktuvit ID of a title.
     * @param {string|number} season 
     * @param {string|number} episode 
     * @returns {Array.<subtitle>}
     */
    async getSubsIDsListEpisode(ktuvitID, season, episode){
        
        //bulding the query. A simple query builder string.
        var query_string = `moduleName=SubtitlesList&SeriesID=${ktuvitID}&Season=${season}&Episode=${episode}`

        var res = await this.getWithLoginInfo(KtuvitManager.KTUVIT.EPISODE_INFO_URL+query_string);
        var subtitles = this.extractSubsFromHtml(res.text);
        return subtitles || [];

    }

    /**
     * return an array of subtitle object for a given movie's ktuvit id.
     * @param {string} ktuvitID Ktuvit ID of a title.
     * @returns {Array.<subtitle>}
     */
    async getSubsIDsListMovie(ktuvitID){
        var res = await this.getWithLoginInfo(KtuvitManager.KTUVIT.MOVIE_INFO_URL+ktuvitID);
        var subtitles = this.extractSubsFromHtml(res.text);
        return subtitles || [];
    }

    /**
     * extracts subtitles info from html page.
     * @typedef subtitle
     * @property {string} subName The sub's file name.
     * @property {string} id SubId of the sub.
     * @property {number} downloads Amount of times the file's been downloaded.
     * @property {date} uploadDate when the sub was uploaded.
     * @property {string} size File size.
     * @property {string} fileType File extension.
     * @property {string} credit The credit's section from Ktuvit website.
     * @param {string} html 
     * @returns {Array.<subtitle>}
     */
    extractSubsFromHtml(html) {
        //The episode html only contains the subtitle rows and since I built this function
        //for the movie's html so I need to add the missing information.
        html = html.includes('<!DOCTYPE html>') ? html:`<!DOCTYPE html><table id="subtitlesList"><thead><tr/></thead>${html}</table>`

        var dummyDom = new jsdom.JSDOM(html).window;
        var subtitlesListElement = dummyDom.document.getElementById('subtitlesList');
        subtitlesListElement = [...subtitlesListElement.rows];
        subtitlesListElement.shift();
        // I don't care it's this way, it works.
        // I never learned jquery so don't judge me.
        var subtitlesIDs = subtitlesListElement.map((sub) => {
            //Getting sub's file name from html.
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

    /**
     * DOwnloads the srt and calls the callback function with the srt content.
     * @param {string} KtuvitId Title's ktuvit id
     * @param {string} subId The sub's id.
     * @param {function (buffer)} cb The callback function
     */
    async downloadSubtitle(KtuvitId, subId, cb){
        const downloadIdentifierRequest = {
            "FilmID": KtuvitId,
            "SubtitleID": subId,
            "FontSize": 0,
            "FontColor": "",
            "PredefinedLayout": -1
        };

        // To prevent unknown download calls. each download has a one time use token called download identifier.
        let downloadIdentifier = await this.postWithLoginInfo(KtuvitManager.KTUVIT.REQUEST_DOWNLOAD_IDENTIFIER_URL,downloadIdentifierRequest);
        downloadIdentifier = JSON.parse(downloadIdentifier.body.d).DownloadIdentifier
        
        await superagent.get(KtuvitManager.KTUVIT.DOWNLOAD_SUB_URL + downloadIdentifier)
            .charset('ISO-8859-8')
            .withCredentials()
            .set(this.headers)
            .buffer(true)
            .then(res => {cb(res.text)})
            .catch(err => err)
    }
}

module.exports = KtuvitManager;
