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

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Você foi convidado(a) pro {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Você recebeu um convite ✨</Heading>
        <Text style={text}>
          Você foi convidado(a) pra fazer parte do{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          . Clique no botão abaixo pra aceitar o convite e criar sua conta.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Aceitar convite
        </Button>
        <Text style={footer}>
          Se você não estava esperando este convite, pode ignorar este e-mail.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

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
