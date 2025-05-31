import React from 'react';
import { Globe, Heart, Shield, FileText, Mail, Github, Twitter } from 'lucide-react';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    product: [
      { name: 'How it Works', href: '#' },
      { name: 'Features', href: '#' },
      { name: 'Safety Tips', href: '#' },
      { name: 'Community Guidelines', href: '#' }
    ],
    legal: [
      { name: 'Terms of Service', href: '#' },
      { name: 'Privacy Policy', href: '#' },
      { name: 'Cookie Policy', href: '#' },
      { name: 'Disclaimer', href: '#' }
    ],
    support: [
      { name: 'Help Center', href: '#' },
      { name: 'Contact Us', href: 'mailto:support@anonverse.com' },
      { name: 'Report Issue', href: '#' },
      { name: 'Feedback', href: '#' }
    ]
  };

  const socialLinks = [
    { name: 'Twitter', icon: Twitter, href: '#' },
    { name: 'GitHub', icon: Github, href: '#' },
    { name: 'Email', icon: Mail, href: 'mailto:hello@anonverse.com' }
  ];

  return (
    <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Main footer content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          
          {/* Brand section */}
          <div className="col-span-1 lg:col-span-1">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Globe className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Anon<span className="text-blue-600 dark:text-blue-400">verse</span>
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
              Connect with strangers worldwide in a safe, anonymous environment. 
              Meet new people, share ideas, and explore the universe of conversations.
            </p>
            
            {/* Social links */}
            <div className="flex space-x-4">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.name}
                    href={social.href}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    title={social.name}
                  >
                    <Icon className="w-5 h-5" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Product links */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide mb-4">
              Product
            </h4>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors text-sm"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal links */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide mb-4">
              Legal
            </h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors text-sm"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Support links */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide mb-4">
              Support
            </h4>
            <ul className="space-y-3">
              {footerLinks.support.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors text-sm"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Safety notice */}
        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-800">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <div className="flex items-start space-x-3">
              <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <h5 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
                  Safety First
                </h5>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>You must be 18 or older to use Anonverse.</strong> Never share personal information 
                  like your full name, address, phone number, or social media accounts. Report any inappropriate 
                  behavior immediately. Remember: stay anonymous, stay safe.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom section */}
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
            <span>© {currentYear} Anonverse. All rights reserved.</span>
            <span className="hidden md:inline">•</span>
            <span className="flex items-center space-x-1">
              <span>Made with</span>
              <Heart className="w-4 h-4 text-red-500" />
              <span>for global connections</span>
            </span>
          </div>
          
          <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>All systems operational</span>
            </div>
            <span className="hidden md:inline">•</span>
            <span>v1.0.0</span>
          </div>
        </div>

        {/* Additional disclaimer */}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            <strong>Disclaimer:</strong> Anonverse is a platform for meeting new people through anonymous conversations. 
            Users are solely responsible for their behavior and interactions. We do not monitor all conversations, 
            though video chats are moderated. Please use common sense, be respectful, and report any violations of 
            our community guidelines. For parents: visit{' '}
            <a href="https://www.connectsafely.org/controls/" className="underline hover:no-underline">
              connectsafely.org
            </a>{' '}
            for parental control information.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;