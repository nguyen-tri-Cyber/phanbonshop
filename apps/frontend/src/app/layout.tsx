import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../contexts/auth-context';
import { CartProvider } from '../contexts/cart-context';
import { CartDrawer } from '../components/customer/cart-drawer';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: {
    default: 'Phân Bón Shop - Nền Tảng TMĐT Phân Bón Việt Nam',
    template: '%s | Phân Bón Shop',
  },
  description:
    'Sàn thương mại điện tử chuyên cung ứng phân bón NPK, phân hữu cơ vi sinh, phân bón lá chính hãng Đầu Trâu, Đạm Phú Mỹ, PVCFC cho nông dân và đại lý.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Phân Bón Shop - Nền Tảng TMĐT Phân Bón Việt Nam',
    description:
      'Sàn thương mại điện tử chuyên cung ứng phân bón NPK, phân hữu cơ vi sinh, phân bón lá chính hãng Đầu Trâu, Đạm Phú Mỹ, PVCFC.',
    url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    siteName: 'Phân Bón Shop',
    locale: 'vi_VN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Phân Bón Shop - Nền Tảng TMĐT Phân Bón Việt Nam',
    description:
      'Sàn thương mại điện tử chuyên cung ứng phân bón NPK, phân hữu cơ vi sinh, phân bón lá chính hãng.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="antialiased min-h-screen flex flex-col">
        <AuthProvider>
          <CartProvider>
            {children}
            <CartDrawer />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
