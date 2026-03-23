import { getEmailTransporter } from '../lib/email';
import * as dotenv from 'dotenv';
dotenv.config();

async function testEmail() {
  console.log('Testing SMTP connection...');
  const transporter = getEmailTransporter();
  
  if (!transporter) {
    console.error('Failed to get transporter. Check SMTP environment variables.');
    return;
  }
  
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: process.env.SMTP_FROM, // Send to self
      subject: 'SMTP Test - Clivaro',
      text: 'If you receive this, SMTP is working correctly.'
    });
    
    console.log('Success! Message sent:', info.messageId);
  } catch (err: any) {
    console.error('SMTP Error:', err.message);
  }
}

testEmail();
