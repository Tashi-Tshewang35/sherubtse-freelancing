// Any unmocked SMTP call fails locally, before it can contact Gmail.
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => { throw new Error('Automated tests must mock email delivery.'); }),
}));
