export const runtime = 'nodejs';
import { Document, Page, Text, renderToBuffer } from '@react-pdf/renderer';
import React from 'react';

export async function GET() {
  const buffer = await renderToBuffer(
    React.createElement(Document, null,
      React.createElement(Page, null,
        React.createElement(Text, null, 'Smoke test')
      )
    )
  );
  return new Response(new Uint8Array(buffer), { headers: { 'Content-Type': 'application/pdf' } });
}
