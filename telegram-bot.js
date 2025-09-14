import TelegramBot from 'node-telegram-bot-api';
import fetch from 'node-fetch';

// Bot token from BotFather
const token = '8256194856:AAGqJPELBjSovJtQqnfOni4CuNa6HX1Xy_I';

// Create bot instance
const bot = new TelegramBot(token, { polling: true });

// Server URL for API calls - use environment variable or fallback to Render URL
const SERVER_URL = process.env.SERVER_BASE_URL || 'https://arthur-game-shop.onrender.com';

// Store pending login requests
const pendingLogins = new Map();

console.log('🤖 Arthur Game Shop Bot started!');
console.log('✅ Telegram bot connected...');
console.log('🌐 Server URL:', SERVER_URL);
console.log('🔧 Environment:', process.env.NODE_ENV || 'development');

// Test server connection on startup
async function testServerConnection() {
  try {
    console.log('🔄 Testing server connection...');
    const response = await fetch(`${SERVER_URL}/health`);
    const data = await response.json();
    console.log('✅ Server connection successful:', data);
  } catch (error) {
    console.error('❌ Server connection failed:', error.message);
    console.log('⚠️ Bot will continue but server calls may fail');
  }
}

// Test server connection
testServerConnection();

// Handle /start command with payload
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const firstName = msg.from.first_name;
  const lastName = msg.from.last_name || '';
  const username = msg.from.username || '';
  
  // Check if there's a start payload (deep link)
  const startPayload = msg.text.split(' ')[1];
  
  if (startPayload) {
    // This is a deep link login request
    console.log(`🔗 Deep link login request: ${startPayload} from user ${userId}`);
    console.log("🔁 Received login request:", startPayload);
    console.log("👤 User details:", { userId, firstName, lastName, username, chatId });
    
    try {
      // Send login request to server
      const confirmUrl = `${SERVER_URL}/api/telegram-bot-confirm`;
      console.log('🔗 Calling API:', confirmUrl);
      console.log('📤 Sending data:', {
        sessionCode: startPayload,
        telegramUserId: userId.toString(),
        firstName: firstName,
        lastName: lastName,
        username: username,
        chatId: chatId
      });
      const response = await fetch(confirmUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionCode: startPayload,
          telegramUserId: userId.toString(),
          firstName: firstName,
          lastName: lastName,
          username: username,
          chatId: chatId
        })
      });
      
      // Check if response is ok
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Server response error:', response.status, errorText);
        throw new Error(`Server error: ${response.status}`);
      }
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const errorText = await response.text();
        console.error('❌ Non-JSON response received:', errorText.substring(0, 200));
        throw new Error('Server returned non-JSON response');
      }
      
      const result = await response.json();
      console.log('📋 Bot confirm response:', result);
      console.log('✅ Response received successfully');
      
      if (result.success) {
        // Login confirmed
        console.log('🎉 Login confirmation successful');
        const confirmMessage = `✅ **Login Confirmed!**\n\n` +
          `Welcome to Arthur Game Shop, ${firstName}!\n\n` +
          `**User Details:**\n` +
          `• User ID: ${userId}\n` +
          `• Username: @${username || 'N/A'}\n` +
          `• Time: ${new Date().toLocaleString()}\n\n` +
          `You can now return to the website and complete your login.`;
        
        await bot.sendMessage(chatId, confirmMessage, { parse_mode: 'Markdown' });
        console.log(`✅ Login confirmed for user ${userId} with session ${startPayload}`);
        console.log('📤 Success message sent to user');
      } else {
        // Login failed
        console.log('❌ Login confirmation failed:', result.error);
        await bot.sendMessage(chatId, `❌ **Login Failed**\n\n${result.error || 'Invalid session code'}`);
        console.log(`❌ Login failed for user ${userId}: ${result.error}`);
        console.log('📤 Error message sent to user');
      }
      
    } catch (error) {
      console.error('❌ Error confirming login:', error);
      let errorMessage = '❌ Sorry, there was an error processing your login. Please try again.';
      
      if (error.message.includes('Server error: 404')) {
        errorMessage = '❌ **Login Failed**\n\nServer endpoint not found. Please contact support.';
      } else if (error.message.includes('Server error: 500')) {
        errorMessage = '❌ **Login Failed**\n\nServer error. Please try again later.';
      } else if (error.message.includes('non-JSON response')) {
        errorMessage = '❌ **Login Failed**\n\nServer configuration error. Please contact support.';
      }
      
      await bot.sendMessage(chatId, errorMessage);
    }
  } else {
    // Regular start command
    const welcomeMessage = `👋 Hello ${firstName}!\n\n` +
      `Welcome to **Arthur Game Shop Bot**! 🎮\n\n` +
      `I can help you with:\n` +
      `• 🔐 Quick login to Arthur Game Shop\n` +
      `• 📊 Check your account balance\n` +
      `• 🎁 View available gifts\n` +
      `• 💰 Manage your wallet\n\n` +
      `Use /login to start a quick login session!`;
    
    bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
  }
});

// Handle /login command
bot.onText(/\/login/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const firstName = msg.from.first_name;
  const username = msg.from.username;
  
  try {
    // Generate security code
    const securityCode = Math.floor(1000000 + Math.random() * 9000000);
    
    // Store pending login
    pendingLogins.set(securityCode, {
      telegramUserId: userId.toString(),
      chatId: chatId,
      firstName: firstName,
      username: username,
      status: 'pending',
      createdAt: new Date()
    });
    
    // Create login request message
    const message = `🔐 **Login Request for Arthur Game Shop**\n\n` +
                   `Hello ${firstName}!\n\n` +
                   `Security Code: \`${securityCode}\`\n\n` +
                   `If you requested this login, please confirm below:`;
    
    const keyboard = {
      inline_keyboard: [
        [
          { text: "✅ Confirm Login", callback_data: `confirm_${securityCode}` },
          { text: "❌ Decline", callback_data: `decline_${securityCode}` }
        ]
      ]
    };
    
    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
    
    console.log(`📱 Login request sent to user ${userId} with code ${securityCode}`);
    
  } catch (error) {
    console.error('❌ Error sending login request:', error);
    bot.sendMessage(chatId, '❌ Sorry, there was an error processing your login request. Please try again.');
  }
});

// Handle callback queries (button clicks)
bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data;
  const messageId = callbackQuery.message.message_id;
  
  try {
    if (data.startsWith('confirm_')) {
      const securityCode = data.replace('confirm_', '');
      const loginData = pendingLogins.get(securityCode);
      
      if (loginData && loginData.telegramUserId === userId.toString()) {
        // Login confirmed - process with server
        const result = await processLoginConfirmation(loginData, securityCode);
        
        if (result.success) {
          // Update message to show success
          await bot.editMessageText(
            `✅ **Login Confirmed!**\n\n` +
            `Welcome to Arthur Game Shop, ${loginData.firstName}!\n\n` +
            `You can now return to the website and access your account.`,
            {
              chat_id: chatId,
              message_id: messageId,
              parse_mode: 'Markdown'
            }
          );
          
          // Answer callback query
          await bot.answerCallbackQuery(callbackQuery.id, {
            text: "✅ Login confirmed! You can now return to the website.",
            show_alert: true
          });
          
          console.log(`✅ Login confirmed for user ${userId}`);
        } else {
          throw new Error(result.error || 'Login confirmation failed');
        }
      } else {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "❌ Invalid or expired login request.",
          show_alert: true
        });
      }
      
    } else if (data.startsWith('decline_')) {
      const securityCode = data.replace('decline_', '');
      const loginData = pendingLogins.get(securityCode);
      
      if (loginData && loginData.telegramUserId === userId.toString()) {
        // Login declined
        await bot.editMessageText(
          `❌ **Login Declined**\n\n` +
          `Login request has been declined.\n\n` +
          `If you need to login, please use /login command again.`,
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown'
          }
        );
        
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "❌ Login declined.",
          show_alert: true
        });
        
        // Clean up
        pendingLogins.delete(securityCode);
        console.log(`❌ Login declined by user ${userId}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error handling callback query:', error);
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: "❌ Sorry, there was an error processing your request.",
      show_alert: true
    });
  }
});

// Process login confirmation with server
async function processLoginConfirmation(loginData, securityCode) {
  try {
    console.log(`🔄 Processing login confirmation for user ${loginData.telegramUserId}`);
    console.log(`🌐 Calling server: ${SERVER_URL}/api/telegram-login-confirm`);
    
    // Call server API to confirm login
    const response = await fetch(`${SERVER_URL}/api/telegram-login-confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        securityCode: securityCode,
        telegramUserId: loginData.telegramUserId,
        firstName: loginData.firstName,
        username: loginData.username,
        chatId: loginData.chatId
      })
    });
    
    console.log(`📡 Server response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Server error ${response.status}: ${errorText}`);
      return { success: false, error: `Server error: ${response.status}` };
    }
    
    const result = await response.json();
    console.log(`📋 Server response:`, result);
    
    if (result.success) {
      // Clean up pending login
      pendingLogins.delete(securityCode);
      return { success: true, user: result.user };
    } else {
      return { success: false, error: result.error };
    }
    
  } catch (error) {
    console.error('❌ Error confirming login with server:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    return { success: false, error: error.message };
  }
}

// Handle /help command
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  
  const helpMessage = `🆘 **Arthur Game Shop Bot Help**\n\n` +
    `**Available Commands:**\n` +
    `• /start - Welcome message and bot introduction\n` +
    `• /login - Start a quick login session\n` +
    `• /help - Show this help message\n\n` +
    `**How to Login:**\n` +
    `1. Use /login command\n` +
    `2. You'll receive a security code\n` +
    `3. Click "Confirm Login" button\n` +
    `4. Return to the website\n\n` +
    `**Need Support?**\n` +
    `Contact us at: support@arthur-gameshop.com`;
  
  bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
});

// Handle /balance command (if user is logged in)
bot.onText(/\/balance/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  try {
    // Check if user exists in our system
    const response = await fetch(`${SERVER_URL}/api/telegram-user-info/${userId}`);
    const result = await response.json();
    
    if (result.success && result.user) {
      const user = result.user;
      const balance = user.balance || 0;
      const tokens = user.tokens || 0;
      
      const balanceMessage = `💰 **Your Account Balance**\n\n` +
        `👤 Name: ${user.name}\n` +
        `📧 Email: ${user.email}\n` +
        `💵 Balance: ${balance} Ks\n` +
        `🎫 Tokens: ${tokens}\n\n` +
        `Visit our website to manage your account!`;
      
      bot.sendMessage(chatId, balanceMessage, { parse_mode: 'Markdown' });
    } else {
      bot.sendMessage(chatId, '❌ You are not registered yet. Please login first using /login command.');
    }
    
  } catch (error) {
    console.error('❌ Error checking balance:', error);
    bot.sendMessage(chatId, '❌ Sorry, there was an error checking your balance. Please try again later.');
  }
});

// Handle any other text messages
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  // Ignore commands (they are handled separately)
  if (text.startsWith('/')) {
    return;
  }
  
  // Respond to general messages
  const responseMessage = `👋 Hello! I'm the Arthur Game Shop Bot.\n\n` +
    `I can help you with:\n` +
    `• /login - Quick login to our website\n` +
    `• /balance - Check your account balance\n` +
    `• /help - Show available commands\n\n` +
    `What would you like to do?`;
  
  bot.sendMessage(chatId, responseMessage);
});

// Error handling
bot.on('error', (error) => {
  console.error('❌ Bot error:', error);
});

bot.on('polling_error', (error) => {
  console.error('❌ Polling error:', error);
});

// Clean up expired login requests every 5 minutes
setInterval(() => {
  const now = new Date();
  for (const [code, loginData] of pendingLogins.entries()) {
    if (now - loginData.createdAt > 5 * 60 * 1000) { // 5 minutes
      pendingLogins.delete(code);
      console.log(`🧹 Cleaned up expired login request: ${code}`);
    }
  }
}, 5 * 60 * 1000);

console.log('✅ Bot is running and ready to handle messages!');
