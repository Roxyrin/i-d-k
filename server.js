   const crypto = require('crypto');

   function verifyTelegramWebAppData(telegramInitData, botToken) {
     const initData = new URLSearchParams(telegramInitData);
     const hash = initData.get('hash');
     initData.delete('hash');

     const dataToCheck = [...initData.entries()]
       .map(([key, value]) => `${key}=${value}`)
       .sort()
       .join('\n');

     const secretKey = crypto.createHmac('sha256', 'WebAppData')
       .update(botToken)
       .digest();

     const calculatedHash = crypto.createHmac('sha256', secretKey)
       .update(dataToCheck)
       .digest('hex');

     return calculatedHash === hash;
   }
   
