// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import fetch from 'node-fetch';
import crypto from 'crypto';


// Modify those according to your own environment settings.
// Note that client_id & client_secret must match the bot application
const client_id = "NzA0OTJjMjU"
const client_secret = "NTY0MTljODc"
const org_id = "PWOIjooqvlS6cWgmyVjhbQE"
const domain = "kasisto-fis-dev.moxo.com"

let binderId

// Get access token for the bot
// Refer to https://devmep.grouphour.com/docs/mep/bot-sdk/
const getBotToken = async () => { 
  const timestamp = new Date().getTime()
  const content = `${client_id}${org_id}${timestamp}`
  
  let signature = crypto.createHmac('sha256', client_secret).update(content).digest("base64");
  let url = new URL(`https://${domain}/v1/apps/token`)

  let params = {client_id, org_id, timestamp, signature}  

  url.search = new URLSearchParams(params).toString();

  const response = await fetch(url)
  const data = await response.json()

  const {access_token} = data
  console.log(`Got a new access token ${access_token}`)
  return access_token
}

//Send Text Message to Moxo binder
const sendMessage = async(token, message) => {
  return fetch(`https://${domain}/v1/${binderId}/messages`, {
    "method": "POST",
    "headers": {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    "body": JSON.stringify(message)
  })
    
}

//Send rich text message ( those with buttons ) to Moxo binder via bbcode
const sendBBCodeMessage = async(token, message) => {
  console.log("Send BB Message")
  console.log(message)
  return fetch(`https://${domain}/v1/${binderId}/messages`, {
    "method": "POST",
    "headers": {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    "body": JSON.stringify(message)
  })
    
}

//start routing to human agent and remove bot from the live chat, if "endChat" is true, then 
//only remove the bot but no routing
const startRouting = async (token, endChat) => {
  let requestUrl = `https://${domain}/v1/acd/${binderId}/bots`
  if(endChat)
    requestUrl = `${requestUrl}?status=ROUTING_STATUS_CLOSE`
  return fetch(requestUrl, {
    "method": "DELETE",
    "headers": {
      "Authorization": `Bearer ${token}`
    }
  })
}


// This is the serverless function entry point
export default async function handler(req, res) {
  console.log("received request")
  console.log(req.body)

  const {
    binder_id,
    message_type,
    event,
  } = req.body

  binderId = binder_id

  let text, payload

  if(event.postback){
      text = event.postback.text
      payload = event.postback.payload
  }
  

console.log("Preparing outbound request")
 
 
try{
  getBotToken().then( async (newToken) => {

      // If this is bbcode button callback event, echo the user selection
      if(message_type === 'bot_postback'){
        const message = {
          message: {
            text: `Your selection is ${payload}`,
          }
        }
        await sendMessage(newToken, message)
      }
    
      // If this is a bot_installed event, send a welcome text message
      if(message_type === 'bot_installed'){
         const message = {
          message: {
            text: `Welcome, you are now connected with bot!!!`,
          }
        }
        await sendMessage(newToken, message)
      }

      //If user asks to route to human agent
      if(payload && payload.indexOf("route") >= 0){
        await startRouting(newToken)    
      } else if(payload && payload.indexOf("end") >= 0){
        await startRouting(newToken, true)    
      } else if(payload && payload.indexOf("payload") >= 0){
        await sendMessage(newToken, {
        message: {
          text: "You send a payload"
        }})    
      } else { 
        const bbcode = {
          message: {
            text: "simple text message",
            richtext: "Please make a choice",
            fields: {
              key1: "value1",
              key2: "value2"
            },
            action: "chat",
            buttons: [
              {
                type: "postback",
                text: "Just End the chat",
                payload: "end"
              },
              {
                type: "postback",
                text: "Route to Human Agent",
                payload: "route"
              },
              {
                type: "postback",
                text: "Send Payload",
                payload: "payload"
              },
            ]
          }
        }

        try{
          const res = await sendBBCodeMessage(newToken, bbcode);
          // console.log(res)
        } catch(e){
          console.log("Error in sending bbcode message " + e)
        }
        
      }
      
      res.status(200).end()
    })
 
} catch(e) {
  console.log("Error in sending message" + e)
}


   
  
  //res.status(200).json({ name: 'John Doe' })
  //res.setHeader('Content-Type', 'text/html').status(200).send("Request received: " + JSON.stringify(req.body))
  
}

