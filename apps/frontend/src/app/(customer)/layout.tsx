import React from 'react';
import { Header } from '../../components/customer/header';
import { Navbar } from '../../components/customer/navbar';
import { Footer } from '../../components/customer/footer';

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <Navbar />
      <main className="flex-1 bg-slate-50">{children}</main>
      <Footer />
    </div>
  );
}
