import React from 'react';
import { BrandLogo } from './components/BrandLogo';
import { LoginForm } from './components/LoginForm';
import {
  LeftSupportingMessage,
  UpperRightSupportingMessage,
} from './components/SupportingMessages';
import { BackgroundDecorations } from './components/BackgroundDecorations';

export default function App() {
  return (
    <main className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 lg:p-10 select-auto overflow-x-hidden">
      {/* Background waves, mint gradients, and architectural render */}
      <BackgroundDecorations />

      {/* Desktop Upper-Right Supporting Pillar (PLAN MANAGE EXECUTE DELIVER) */}
      <div className="absolute top-10 right-8 xl:top-14 xl:right-16 z-10 pointer-events-none">
        <UpperRightSupportingMessage />
      </div>

      {/* Desktop Lower-Left Supporting Message (People. Projects. Progress.) */}
      <div className="absolute left-8 xl:left-16 top-[54%] -translate-y-1/2 z-10 pointer-events-none">
        <LeftSupportingMessage />
      </div>

      {/* Central Interactive Column: Brand Header + Login Panel */}
      <div className="w-full flex flex-col items-center justify-center z-10 my-auto py-6">
        {/* Brand Area */}
        <div className="mb-6 sm:mb-8">
          <BrandLogo />
        </div>

        {/* Primary Enterprise Login Card */}
        <div className="w-full flex justify-center">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
