export const EMAIL_CONFIG = {
  logoFilename: 'logo.png',
  defaultProductName: 'Tailgate',
  social: {
    website: 'https://tailgate.com',
    linkedin: 'https://linkedin.com/company/tailgate',
    github: 'https://github.com/tailgate',
    x: 'https://x.com/tailgate',
    facebook: 'https://facebook.com/tailgate',
  },
};

export function getLogoUrl(siteUrl: string) {
  return `${siteUrl}/images/${EMAIL_CONFIG.logoFilename}`;
}
