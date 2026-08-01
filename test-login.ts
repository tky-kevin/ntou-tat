import { getLoginChallenge, login } from './src/api/portal';
import { AIS_HOST } from './src/api/portalHttp';

async function main() {
  try {
    console.log('Fetching login challenge...');
    const challenge = await getLoginChallenge();
    console.log('Challenge:', { ...challenge, captchaDataUrl: '...' });
    
    console.log('Logging in...');
    // Login with the provided credentials
    const session = await login({
      account: '01357140',
      password: 'Kk33443344',
      captcha: '1234', // Captcha is bypassed or handled by model? Wait, AIS has captcha.
      challenge
    });
    console.log('Session:', session);
  } catch (error) {
    console.error('Login failed:', error);
  }
}

main();
