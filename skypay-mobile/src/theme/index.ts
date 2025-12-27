// skypay-mobile/src/theme/index.ts
export const colors = {
  primary: '#0066FF',
  primaryLight: '#3B82F6',
  primaryDark: '#1D4ED8',
  
  secondary: '#8B5CF6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  
  background: '#FFFFFF',
  surface: '#F8FAFC',
  surfaceDark: '#F1F5F9',
  
  text: '#1E293B',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  
  // SkyPay specific colors
  skypayBlue: '#0066FF',
  skypayPurple: '#8B5CF6',
  skypayGreen: '#10B981',
  skypayOrange: '#F59E0B',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const typography = {
  h1: {
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    lineHeight: 40,
  },
  h2: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    lineHeight: 32,
  },
  h3: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    lineHeight: 28,
  },
  h4: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    lineHeight: 24,
  },
  body: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    lineHeight: 24,
  },
  bodyMedium: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    lineHeight: 24,
  },
  bodySmall: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    lineHeight: 16,
  },
  captionMedium: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    lineHeight: 16,
  },
};

export const shadows = {
  small: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
};

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  round: 9999,
};
