/* *
 *car by country game js 1.0
 *Front end displays not added. 
**/
const Alexa = require('ask-sdk-core');
const AWS = require('aws-sdk');
const ddbAdapter = require('ask-sdk-dynamodb-persistence-adapter');

// are you tracking past questions between sessions
const questionTracking = false;

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    async handle(handlerInput) {
        //set up our Settings api foundations
        const serviceClientFactory = handlerInput.serviceClientFactory;
        const deviceId = handlerInput.requestEnvelope.context.System.device.deviceId;

        // initialize some variables
        var userTimeZone, greeting;

        // wrap the API call in a try/catch block in case the call fails for
        // whatever reason.
        try {
            const upsServiceClient = serviceClientFactory.getUpsServiceClient();
            userTimeZone = await upsServiceClient.getSystemTimeZone(deviceId);
        } catch (error) {
            userTimeZone = "error";
            console.log('error', error.message);
        }

        // calculate our greeting
        if(userTimeZone === "error"){
            greeting = "Hello.";
        } else {
            // get the hour of the day or night in your customer's time zone
            const cfunctions = await require('./carBrandGame.js');
            var hour = cfunctions.getHour(userTimeZone);
            if(0<=hour&&hour<=4){
                greeting = "Hi night-owl!"
            } else if (5<=hour&&hour<=11) {
                greeting = "Good morning!"
            } else if (12<=hour&&hour<=17) {
                greeting = "Good afternoon!"
            } else if (17<=hour&&hour<=23) {
                greeting = "Good evening!"
            } else {
                greeting = "Howdy partner!"   
            }
        }

        var speakOutput = '';
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

        if(sessionAttributes.visits === 0){
            speakOutput = `${greeting} Welcome to Car by Country Quiz. I'll tell you a car brand and
                you try to guess the country of origin of the brand. See how many you can get!
                Would you like to play?`;
        } else {
            speakOutput = `${greeting} Excited to see you again! Welcome back to Car by Country! 
            Ready to guess some more car brands?`
        }

        // increment the number of visits and save the session attributes so the
        // ResponseInterceptor will save it persistently.
        sessionAttributes.visits += 1;
        // MAke sure the number of guess in each question start with 0.
        sessionAttributes.numOfGuess = 0;
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};


const PlayGameHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.YesIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'RepeatQuestionIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'ContinueToPlayIntent');
    },
    handle(handlerInput) {
        // get the current session attributes
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        // init speech output
        var speakOutput = '';

        // check if there's a current car. If so, repeat the question.
        if (
            sessionAttributes.currentCar !== null
        ){
            speakOutput = `Where is ${sessionAttributes.currentCar.brand} from?`;
            return handlerInput.responseBuilder
                .speak(speakOutput)
                .reprompt(speakOutput)
                .getResponse();
        }

        // import the carBrandGame function and get a random brand.
        const cfunctions = require('./carBrandGame.js');
        const car = cfunctions.getRandomCar(sessionAttributes.pastCars);
        // check to see if there are any brands left.
        if (car.id === 0) {
            speakOutput = `You have run out of cars. Thanks for playing!`; 
        } else {
            sessionAttributes.currentCar = car;
            //save the session attributes and ask the question
            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
            speakOutput = `Where is ${car.brand} from?`;
        }
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
        }
};

const GetCountryNameIntentHandler = {
    canHandle(handlerInput) {
        return (
            Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
            Alexa.getIntentName(handlerInput.requestEnvelope) === 'GetCountryNameIntent'
        );
    },

    handle(handlerInput) {
        // get the current session attributes
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        // init speech output
        var speakOutput = '';

        // if the currentCar is empty, error, cue them to say "yes" and end
        if (sessionAttributes.currentCar === null)
        {
            speakOutput =
                "I'm sorry, there's no active question right now. Would you like a question?";
            return handlerInput.responseBuilder
                .speak(speakOutput)
                .reprompt(speakOutput)
                .getResponse();
        }
        // get the slot value
        const userReponse = handlerInput.requestEnvelope.request.intent.slots.country.value;

        // check the answer
        const cfunctions = require('./carBrandGame.js');
        const winner = cfunctions.checkAnswer(sessionAttributes.currentCar,userReponse);

        sessionAttributes.numOfGuess += 1;
        // store the value for the speakOut
        const cbrand = sessionAttributes.currentCar.brand;

        // get ready for next question
        const car = cfunctions.getRandomCar(sessionAttributes.pastCars);
        var nextQuestion = ''
            // check to see if there are any brands left.
        if (car.id === 0) {
            nextQuestion = `You have run out of brands. Thanks for playing!`; 
        } else {
            //Ask the question
            nextQuestion = `Moving on!Where is ${car.brand} from?`;
        }

        //Did they get it?
        if (winner) {
            sessionAttributes.score += 1;
            speakOutput = `Yay! You got ${cbrand}'s country right! Your score is now
            ${sessionAttributes.score}. ${nextQuestion}`;
            // Add the car to the list of past cars.
            sessionAttributes.pastCars.push(sessionAttributes.currentCar);
            //set the new "currentCar" attribute
            sessionAttributes.currentCar = car;
            sessionAttributes.numOfGuess = 0;
        } else if(sessionAttributes.numOfGuess < 3){
            speakOutput = `Sorry. You didn't get the right country of origin for
            ${cbrand}. Have another try.`;
        } else {
            speakOutput = `Sorry. You didn't get the right country of origin for
            ${cbrand}. Maybe you'll get the next one. ${nextQuestion}`;
            // Add the car to the list of past cars.
            sessionAttributes.pastCars.push(sessionAttributes.currentCar);
            //set the new "currentCar" attribute
            sessionAttributes.currentCar = car;
            sessionAttributes.numOfGuess = 0;
        }

        //store all the updated session data
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const SkipTheQuestionIntentHandler = {
    canHandle(handlerInput) {
        return (
            Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
            Alexa.getIntentName(handlerInput.requestEnvelope) === 'SkipTheQuestionIntent'
        );
    },
    handle(handlerInput) {
        // get the current session attributes
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        // init speech output
        var speakOutput = '';

        // import the carBrandGame function and get a random brand.
        const cfunctions = require('./carBrandGame.js');
        const car = cfunctions.getRandomCar(sessionAttributes.pastCars);
        // check to see if there are any brands left.
        if (car.id === 0) {
            speakOutput = `You have run out of cars. Thanks for playing!`; 
        } else {
            sessionAttributes.currentCar = car;
            //save the session attributes and ask the question
            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
            speakOutput = `Let's move to the next one. Where is ${car.brand} from?`;
        }
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
        }
};



const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'How can I help? Save CONTINUE to move on, or say STOP to quit.';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        // get the current session attributes
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const score = sessionAttributes.score;

        var speakOutput = '';
        if(score > 1){
            speakOutput = `Your scored ${score} this time. Good try!See you next time!`;
        } else {
            speakOutput = `Goodbye and have a nice day!`;
        }

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};
/* *
 * FallbackIntent triggers when a customer says something that doesn't map to any intents in your skill
 * It must also be defined in the language model (if the locale supports it)
 * This handler can be safely added but will be ingnored in locales that do not support it yet
 * */
const FallbackIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'Sorry, I don\'t know about that. Please try again.';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};
/* *
 * SessionEndedRequest notifies that a session was ended. This handler will be triggered when a currently open
 * session is closed for one of the following reasons: 1) The user says "exit" or "quit". 2) The user does not
 * respond or says something that does not match an intent defined in your voice model. 3) An error occurs
 * */
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log(`~~~~ Session ended: ${JSON.stringify(handlerInput.requestEnvelope)}`);
        // Any cleanup logic goes here.
        return handlerInput.responseBuilder.getResponse(); // notice we send an empty response
    }
};
/* *
 * The intent reflector is used for interaction model testing and debugging.
 * It will simply repeat the intent the user said. You can create custom handlers for your intents
 * by defining them above, then also adding them to the request handler chain below
 * */
const IntentReflectorHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest';
    },
    handle(handlerInput) {
        const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
        const speakOutput = `You just triggered ${intentName}`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    }
};
/**
 * Generic error handling to capture any syntax or routing errors. If you receive an error
 * stating the request handler chain is not found, you have not implemented a handler for
 * the intent being invoked or included it in the skill builder below
 * */
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        const speakOutput = 'Sorry, I had trouble doing what you asked. Please try again.';
        console.log(`~~~~ Error handled: ${JSON.stringify(error)}`);

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const LoadDataInterceptor = {
    async process(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

        // get persistent attributes, using await to ensure the data has been returned before
        // continuing execution
        var persistent = await handlerInput.attributesManager.getPersistentAttributes();
        if(!persistent) persistent = {};

        // ensure important variables are initialized so they're used more easily in handlers.
        // This makes sure they're ready to go and makes the handler code a little more readable
        if(!sessionAttributes.hasOwnProperty('currentCar')) sessionAttributes.currentCar = null;  
        if(!sessionAttributes.hasOwnProperty('score')) sessionAttributes.score = 0;
        if(!persistent.hasOwnProperty('pastCars')) persistent.pastCars = [];  
        if(!sessionAttributes.hasOwnProperty('pastCars')) sessionAttributes.pastCars = []; 
        if(!sessionAttributes.hasOwnProperty('numOfGuess')) sessionAttributes.numOfGuess = 0; 

        // if you're tracking pastCars between sessions, use the persistent value
        // set the visits value (either 0 for new, or the persistent value)
        sessionAttributes.pastCars = (questionTracking) ? persistent.pastCars : sessionAttributes.pastCars;
        sessionAttributes.visits = (persistent.hasOwnProperty('visits')) ? persistent.visits : 0;

        //set the session attributes so they're available to your handlers
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
    }
};
// This request interceptor will log all incoming requests of this lambda
const LoggingRequestInterceptor = {
    process(handlerInput) {
        console.log('----- REQUEST -----');
        console.log(JSON.stringify(handlerInput.requestEnvelope, null, 2));
    }
};

// Response Interceptors run after all skill handlers complete, before the response is
// sent to the Alexa servers.
const SaveDataInterceptor = {
    async process(handlerInput) {
        const persistent = {};
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        // save (or not) the pastCars & visits
        persistent.pastCars = (questionTracking) ? sessionAttributes.pastCars : [];
        persistent.visits = sessionAttributes.visits;
        // set and then save the persistent attributes
        handlerInput.attributesManager.setPersistentAttributes(persistent);
        let waiter = await handlerInput.attributesManager.savePersistentAttributes();
    }
};
// This response interceptor will log all outgoing responses of this lambda
const LoggingResponseInterceptor = {
    process(handlerInput, response) {
        console.log('----- RESPONSE -----');
        console.log(JSON.stringify(response, null, 2));
    }
};


/**
 * This handler acts as the entry point for your skill, routing all request and response
 * payloads to the handlers above. Make sure any new handlers or interceptors you've
 * defined are included below. The order matters - they're processed top to bottom
 * */
exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        PlayGameHandler,
        GetCountryNameIntentHandler,
        SkipTheQuestionIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        FallbackIntentHandler,
        SessionEndedRequestHandler,
        IntentReflectorHandler)
    .addRequestInterceptors(
        LoadDataInterceptor,
        LoggingRequestInterceptor
    )
    .addResponseInterceptors(
        SaveDataInterceptor,
        LoggingResponseInterceptor
    )
    .addErrorHandlers(
        ErrorHandler)
    .withPersistenceAdapter(
        new ddbAdapter.DynamoDbPersistenceAdapter({
            tableName: process.env.DYNAMODB_PERSISTENCE_TABLE_NAME,
            createTable: false,
            dynamoDBClient: new AWS.DynamoDB({apiVersion: 'latest', region: process.env.DYNAMODB_PERSISTENCE_REGION})
        })
    )
    .withCustomUserAgent('sample/hello-world/v1.2')
    .withApiClient(new Alexa.DefaultApiClient())
    .lambda();