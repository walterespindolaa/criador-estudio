/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Confirme seu e-mail no {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Boas-vindas ao {siteName} ✨</Heading>
        <Text style={text}>
          Que bom ter você por aqui! Falta só um passo pra começar a criar,
          organizar e aparecer com muito mais leveza.
        </Text>
        <Text style={text}>
          Confirme o e-mail{' '}
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>{' '}
          clicando no botão abaixo:
        </Text>
        <Button style={button} href={confirmationUrl}>
          Confirmar meu e-mail
        </Button>
        <Text style={footer}>
          Se você não criou uma conta em{' '}
          <Link href={siteUrl} style={footerLink}>
            {siteName}
          </Link>
          , pode ignorar este e-mail sem problema.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif", color: '#0A0A0A' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = {
  fontSize: '24px',
  fontWeight: '600' as const,
  color: '#0A0A0A',
  margin: '0 0 20px',
  letterSpacing: '-0.01em',
}
const text = {
  fontSize: '15px',
  color: '#6B6459',
  lineHeight: '1.6',
  margin: '0 0 20px',
}
const link = { color: '#EA5B27', textDecoration: 'underline' }
const button = {
  backgroundColor: '#EA5B27',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600' as const,
  borderRadius: '16px',
  padding: '14px 24px',
  textDecoration: 'none',
  display: 'inline-block',
  margin: '8px 0 24px',
}
const footer = { fontSize: '13px', color: '#9A9388', lineHeight: '1.5', margin: '32px 0 0' }
const footerLink = { color: '#9A9388', textDecoration: 'underline' }
