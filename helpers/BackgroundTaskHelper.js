const fs = require('fs');
const path = require('path');
const axios = require('axios');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const WAN_JON_PATH = path.join(__dirname, '..', 'json', 'wan-ip.json');

// Cloudflare configuration
const CF_URL = process.env.CLOUD_FLARE_URL;
const CF_TOKEN = process.env.CLOUD_FLARE_TOKEN;
const CF_ZONE_ID = process.env.CLOUD_FLARE_ZONE_ID;
const CF_DNS_NAMES = (process.env.CLOUD_FLARE_DNS_NAMES || '').split(',').map(s => s.trim()).filter(Boolean);

// Email configuration
const emailConfig = {
    service: 'Gmail', // e.g., 'Gmail', 'Outlook', 'SendGrid', etc.
    auth: {
        user: 'vunguyencapital@gmail.com',
        pass: 'qzegeugctecrshwn'
    }
};

async function getCurrentIP() {
    const apis = [
        { url: 'https://api.ipify.org?format=json', extract: data => data.ip },
        { url: 'https://api64.ipify.org?format=json', extract: data => data.ip },
        { url: 'https://ifconfig.me/all.json', extract: data => data.ip_addr },
        { url: 'https://httpbin.org/ip', extract: data => data.origin ? data.origin.split(',')[0].trim() : null }
    ];

    for (const api of apis) {
        try {
            const response = await axios.get(api.url, { timeout: 5000 });
            const ip = api.extract(response.data);
            if (ip) return ip;
        } catch (error) {
            console.error(`Error while fetching WAN IP from ${api.url}:`, error.message);
        }
    }
    return null;
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

/**
 * Tìm DNS record ID theo tên domain (type A)
 * @param {string} dnsName - tên domain, ví dụ: "vugroup.org"
 * @returns {object|null} - DNS record object hoặc null
 */
async function findDnsRecord(dnsName) {
    try {
        const url = `${CF_URL}/client/v4/zones/${CF_ZONE_ID}/dns_records?type=A&name=${dnsName}`;
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${CF_TOKEN}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        if (response.data.success && response.data.result.length > 0) {
            return response.data.result[0];
        }
        console.warn(`[Cloudflare] No A record found for: ${dnsName}`);
        return null;
    } catch (error) {
        console.error(`[Cloudflare] Error finding DNS record for ${dnsName}:`, error.message);
        return null;
    }
}

/**
 * Update DNS record type A với IP mới
 * @param {string} recordId - Cloudflare DNS record ID
 * @param {string} dnsName - tên domain
 * @param {string} newIP - IP mới cần update
 * @returns {boolean} - true nếu update thành công
 */
async function updateDnsRecord(recordId, dnsName, newIP) {
    try {
        const url = `${CF_URL}/client/v4/zones/${CF_ZONE_ID}/dns_records/${recordId}`;
        const response = await axios.put(url, {
            type: 'A',
            name: dnsName,
            content: newIP,
            ttl: 1,       // Auto TTL
            proxied: true  // Qua Cloudflare proxy (orange cloud)
        }, {
            headers: {
                'Authorization': `Bearer ${CF_TOKEN}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        if (response.data.success) {
            console.log(`[Cloudflare] ✅ Updated ${dnsName} -> ${newIP}`);
            return true;
        } else {
            console.error(`[Cloudflare] ❌ Failed to update ${dnsName}:`, response.data.errors);
            return false;
        }
    } catch (error) {
        console.error(`[Cloudflare] ❌ Error updating ${dnsName}:`, error.message);
        return false;
    }
}

/**
 * Update tất cả DNS records trong danh sách CLOUD_FLARE_DNS_NAMES
 * @param {string} newIP - IP mới
 */
async function updateAllCloudflareDns(newIP) {
    if (!CF_ZONE_ID || !CF_TOKEN || CF_DNS_NAMES.length === 0) {
        console.warn('[Cloudflare] Missing config (ZONE_ID, TOKEN, or DNS_NAMES). Skipping DNS update.');
        return;
    }

    console.log(`[Cloudflare] Updating ${CF_DNS_NAMES.length} DNS records to IP: ${newIP}`);

    for (const dnsName of CF_DNS_NAMES) {
        const record = await findDnsRecord(dnsName);
        if (!record) {
            console.warn(`[Cloudflare] ⚠️ Skipping ${dnsName} - record not found`);
            continue;
        }

        // Nếu IP đã đúng rồi thì skip
        if (record.content === newIP) {
            console.log(`[Cloudflare] ⏭️ ${dnsName} already points to ${newIP}, skipping.`);
            continue;
        }

        await updateDnsRecord(record.id, dnsName, newIP);
    }
}


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

        // Auto-update Cloudflare DNS records
        await updateAllCloudflareDns(currentIP);

    }
};

// Schedule the cron job to run every 3 minutes
cron.schedule('*/1 * * * *', () => {
    runIPCheckAndEmail();
});
