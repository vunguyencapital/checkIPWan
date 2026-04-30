const fs = require('fs');
const path = require('path');
const axios = require('axios');
const nodemailer = require('nodemailer');
const cron = require('node-cron')

const WAN_JON_PATH = path.join(__dirname, '..', 'json', 'wan-ip.json');
// Email configuration
const emailConfig = {
    service: 'Gmail', // e.g., 'Gmail', 'Outlook', 'SendGrid', etc.
    auth: {
        user: 'vunguyencapital@gmail.com',
        pass: 'qzegeugctecrshwn'
    }
};


// // api:4456be0f
// // secret:864X00low1J69qpn

// const nexmo = new Nexmo({
//     apiKey: '4456be0f',
//     apiSecret: '864X00low1J69qpn'
// });

async function getCurrentIP() {
    try {
        const response = await axios.get('https://api.ipify.org?format=json');
        const { ip } = response.data;
        return ip;
    } catch (error) {
        console.error('Error while fetching WAN IP:', error.message);
        return null;
    }
}

function readWanIPFile() {
    try {
        const fileContents = fs.readFileSync(WAN_JON_PATH, 'utf8');
        return JSON.parse(fileContents);
    } catch (error) {
        console.error('Error while reading wan-ip.json:', error.message);
        return null;
    }
}

function writeWanIPFile(ip) {
    try {
        const data = {
            ip: ip
        };
        fs.writeFileSync(WAN_JON_PATH, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error('Error while writing wan-ip.json:', error.message);
    }
}

// Function to send an email
async function sendEmail(newIP) {
    try {
        const recipientEmail = 'vunguyen5127@gmail.com';
        const transporter = nodemailer.createTransport(emailConfig);

        const mailOptions = {
            from: 'vunguyencapital@gmail.com',
            to: recipientEmail,
            subject: 'WAN IP Address Change',
            text: `The WAN IP address has changed to: ${newIP}`
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent:', info.response);
    } catch (error) {
        console.error('Error while sending email:', error.message);
    }
}

// function sendSMS(){
//     nexmo.message.sendSms('YOUR_VIRTUAL_NUMBER', '+84978527669', 'Hello from Nexmo!', (err, responseData) => {
//         if (err) {
//           console.log('Error sending SMS:', err);
//         } else {
//           if (responseData.messages[0]['status'] === '0') {
//             console.log('SMS sent successfully.');
//           } else {
//             console.log('SMS failed with error:', responseData.messages[0]['error-text']);
//           }
//         }
//       });
// }


async function runIPCheckAndEmail() {
    const currentIP = await getCurrentIP();
    if (!currentIP) {
        console.log('Failed to retrieve WAN IP.');
        return;
    }

    const wanIPData = readWanIPFile();
    if (!wanIPData) {
        console.log('Failed to read wan-ip.json.');
        return;
    }

    const savedIP = wanIPData.ip;
    if (currentIP !== savedIP) {
        console.log('WAN IP has changed. Updating wan-ip.json...');
        writeWanIPFile(currentIP);
        console.log('wan-ip.json has been updated with the new IP:', currentIP);
        sendEmail(currentIP);

    } else {
        console.log('WAN IP has not changed.');
    }
};

// Schedule the cron job to run every 10 minutes
cron.schedule('*/10 * * * *', () => {
    console.log('Running IP check and email...');
    runIPCheckAndEmail();
});