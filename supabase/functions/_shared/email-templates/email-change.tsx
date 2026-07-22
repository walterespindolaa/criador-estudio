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

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Confirme a troca de e-mail no {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Confirmar troca de e-mail</Heading>
        <Text style={text}>
          Você pediu pra trocar o e-mail da sua conta no {siteName} de{' '}
          <Link href={`mailto:${oldEmail}`} style={link}>
            {oldEmail}
          </Link>{' '}
          para{' '}
          <Link href={`mailto:${newEmail}`} style={link}>
            {newEmail}
          </Link>
          .
        </Text>
        <Text style={text}>Clique no botão abaixo pra confirmar a troca:</Text>
        <Button style={button} href={confirmationUrl}>
          Confirmar troca de e-mail
        </Button>
        <Text style={footer}>
          Se não foi você que pediu essa troca, proteja sua conta agora mesmo
          alterando sua senha.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

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
