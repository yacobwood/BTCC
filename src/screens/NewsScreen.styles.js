import {StyleSheet} from 'react-native';
import {Colors} from '../theme/colors';

export default StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  favBorder: {borderLeftWidth: 3, borderLeftColor: Colors.yellow},
  center: {flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center'},

  // Hero
  hero: {width: '100%', height: 340},
  heroImage: {width: '100%', height: '100%', position: 'absolute'},
  heroGradient: {
    flex: 1,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 48,
  },
  headerBtn: {padding: 6},
  logoImage: {height: 38, width: 120},
  heroBottom: {
    padding: 16,
    paddingBottom: 20,
    // Strong gradient at bottom for readability
    backgroundColor: 'transparent',
  },
  heroCategory: {
    color: Colors.yellow,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 10,
  },
  heroDate: {color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 8},

  // Grid row (2 cards side by side)
  gridRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginTop: 10,
  },
  gridCard: {
    flex: 1,
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.card,
  },
  gridImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    // Simulated gradient via layered background
  },
  gridContent: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  gridTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 4,
  },
  gridDate: {color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 4},

  // More stories header
  moreHeader: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 10,
  },

  // Compact card (list item)
  compactCard: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: Colors.card,
    borderRadius: 12,
    overflow: 'hidden',
  },
  compactImage: {width: 100, height: 90},
  compactContent: {flex: 1, padding: 10, justifyContent: 'center'},
  compactCategory: {
    color: Colors.yellow,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 3,
  },
  compactTitle: {color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 18},
  compactDate: {color: Colors.textSecondary, fontSize: 11, marginTop: 4},
  sourceBadge: {
    alignSelf: 'flex-start',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginBottom: 4,
  },
  sourceBadgeText: {fontSize: 9, fontWeight: '800', letterSpacing: 0.5},

  // Error / retry
  errorText: {color: Colors.textSecondary, fontSize: 14},
  retryBtn: {
    marginTop: 16,
    backgroundColor: Colors.yellow,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {color: Colors.navy, fontWeight: '700'},

  // Search bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    marginHorizontal: 12,
    marginTop: 48,
    marginBottom: 8,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {flex: 1, color: '#fff', fontSize: 15, marginLeft: 8},
  scrollTopFab: {
    position: 'absolute',
    bottom: 20,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.yellow,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
  },
});
