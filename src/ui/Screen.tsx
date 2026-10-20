import React, { useEffect } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { COLORS } from './theme';
import Backdrop from './Backdrop';
import Icon from './Icon';
import { COL_MAX, useLayout } from './layout';
import { TYPE } from './type';

/**
 * The widest a two-column body may run to, in dp.
 *
 * Two reading columns and the gap between them. A page wider than this centres
 * the pair rather than pushing them apart: a row whose label is at one edge of
 * a tablet and whose switch is at the other is a row nobody can read as one
 * thing.
 */
const PAIR_MAX = COL_MAX * 2 + 14;

/**
 * The narrowest a body may be and still be worth splitting in two, in dp.
 *
 * Two columns of 300 and the gap between them. 300 is about where a settings
 * row stops working: the bead, the gap, the label and its hint, and a switch
 * or a chevron at the far end. Below that, two columns is worse than one --
 * the labels start wrapping and the page is harder to read than the scroll it
 * was trying to avoid. A small phone held sideways lands under this and keeps
 * the single column.
 */
const PAIR_MIN = 300 * 2 + 14;

/**
 * A whole page: the leaderboard and the settings each own one.
 *
 * They used to be sheets that slid up over the paused game, which is right for
 * the shop -- a quick in-and-out -- and wrong for these two. A board someone
 * reads down and a list of switches someone works through both want the whole
 * screen, a title of their own and one obvious way back.
 *
 * It is still drawn inside the game's view tree rather than as a native modal
 * window, for the same reason the sheet is: a native modal lives in its own
 * window and takes its orientation from the OS. Drawn here it always shares
 * the game's size and orientation, and it covers the touch layer so the run
 * underneath cannot be steered through it.
 *
 * The game is sideways throughout, so the window this is drawn into is short
 * and wide, and a page that ran its rows the full width of it would be setting
 * a label at one edge of the screen and its switch at the other. The body is
 * a centred column instead, capped at a width a row can be read across -- and
 * with `columns`, a pair of them side by side, which is what turns the spare
 * width into a page that does not have to be scrolled at all. See `layout`.
 */
function Screen({
  title,
  /** A line under the title -- where the player is, what the list is. */
  subtitle,
  onBack,
  /** False when the page lays out its own body and must not be scrolled. */
  scroll = true,
  /**
   * True on a page whose body is a handful of self-contained blocks that read
   * as well beside each other as under each other -- the groups of switches on
   * the settings page. Held sideways there is room for two of them abreast,
   * which is the difference between a page that fits and one that is scrolled
   * past its own bottom. A list that has an order to it -- the board -- says
   * nothing here and stays one column.
   */
  columns = false,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  scroll?: boolean;
  columns?: boolean;
  children: React.ReactNode;
}) {
  const { w: width, h: height, top, bottom, gutL, gutR, col, tight } = useLayout();
  // Two abreast only where the page asked for it, the viewport is the short
  // wide one a phone gives sideways, and there is genuinely room for two
  // readable columns rather than two cramped ones.
  const paired = columns && tight && width - gutL - gutR >= PAIR_MIN;
  const bodyW = paired ? Math.min(PAIR_MAX, width - gutL - gutR) : col;

  // The hardware back button leaves the page, the way it leaves anything else.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  return (
    // The page claims every touch its own controls do not: a plain View never
    // becomes the responder, so without this a tap on the background reaches
    // the run underneath and steers it blind.
    <View style={styles.fill} onStartShouldSetResponder={() => true}>
      {/* The same cast as the game and the splash, held well back so a list of
          rows stays the thing being read. */}
      <Backdrop camY={0} width={width} height={height} dim={0.55} />
      {/* Night falls over the sky here rather than the sky being left out.
          A page of switches wants a dark, quiet ground and pale type on it --
          but the player should still be able to see they are standing in the
          same world the game is, which a flat panel of navy would deny. */}
      <View pointerEvents="none" style={styles.veil} />

      <View
        style={[
          styles.head,
          tight ? styles.headTight : styles.headRoomy,
          { paddingTop: top + (tight ? 6 : 10), paddingLeft: gutL - 4, paddingRight: gutR - 4 },
        ]}>
        <Pressable
          onPress={onBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <Icon name="back" size={28} />
        </Pressable>
        <View style={styles.headText}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? (
            <Text numberOfLines={1} style={styles.subtitle}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {/* Balances the back button, so the title sits in the middle. It is
            bare space on purpose: drawn with the back button's own ring it
            read as a second control in the corner that did nothing when it
            was pressed. */}
        <View pointerEvents="none" style={styles.balance} />
      </View>

      {/* The content, held to a column it can be read across and centred in
          whatever is left over. `paired` turns that one column into two
          abreast: the children become a wrapping row of cells, each growing
          to share the row and capped at the width one column would have
          had. No page passes `scroll={false}` today, but the branch below
          gets the same treatment so the two cannot drift apart. */}
      {scroll ? (
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingLeft: gutL, paddingRight: gutR, paddingBottom: bottom + (tight ? 16 : 28) },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <View style={[styles.body, paired && styles.pair, { width: bodyW }]}>
            {paired ? wrapColumns(children) : children}
          </View>
        </ScrollView>
      ) : (
        <View
          style={[
            styles.scroll,
            styles.plain,
            { paddingLeft: gutL, paddingRight: gutR, paddingBottom: bottom + (tight ? 16 : 28) },
          ]}>
          <View style={[styles.body, styles.plain, paired && styles.pair, { width: bodyW }]}>
            {paired ? wrapColumns(children) : children}
          </View>
        </View>
      )}
    </View>
  );
}

/**
 * Each block of the body in a half-width cell, for the two-abreast layout.
 *
 * Wrapped rather than styled in place: the pages hand this their own groups,
 * and a `cloneElement` that pushed a width onto them would be reaching into
 * styles those pages own. A cell around each one says the same thing and says
 * it from out here.
 *
 * A cell grows to share the row with whatever else is on it and is capped at
 * the same width one column would have been, so a body that turns out to hold
 * a single block reads as the one-column page rather than as a row stretched
 * the width of a tablet.
 */
function wrapColumns(children: React.ReactNode) {
  return React.Children.map(children, child =>
    child == null || typeof child === 'boolean' ? child : <View style={styles.cell}>{child}</View>,
  );
}

/** A labelled band between groups of rows. */
export function ScreenSection({ label }: { label: string }) {
  return <Text style={styles.section}>{label}</Text>;
}

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: COLORS.bg,
  },
  veil: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: COLORS.night,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // The band under the title. Shallower on a short viewport, where every dp
  // it gives up is one the body gets.
  headRoomy: { paddingBottom: 12 },
  headTight: { paddingBottom: 8 },
  back: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: COLORS.line,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balance: { width: 42, height: 42 },
  pressed: { opacity: 0.6, transform: [{ scale: 0.96 }] },
  headText: { flex: 1, alignItems: 'center' },
  title: { fontSize: 20, ...TYPE.black, letterSpacing: 2, color: COLORS.ink },
  subtitle: { fontSize: 12, ...TYPE.semi, color: COLORS.muted, marginTop: 2 },
  // The scroller's own padding: the side gutters, which carry the safe area
  // down each side -- held sideways that is where the cutout and the corner
  // curves are, and they are exactly where a full-width row would end up.
  scroll: { alignItems: 'center' },
  // The column itself, centred by the scroller above it.
  body: { gap: 12 },
  // Two abreast. `flex-start` rather than stretch so a short group does not
  // grow to the height of a tall one beside it and leave a panel of dead
  // colour under its last row.
  pair: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 14,
  },
  cell: { flexGrow: 1, flexBasis: 240, maxWidth: COL_MAX },
  // A non-scrolling body has to be allowed to shrink, or a long list pushes
  // the page past the height it has.
  plain: { flex: 1 },
  section: {
    fontSize: 11,
    ...TYPE.black,
    letterSpacing: 2,
    color: COLORS.muted,
    marginTop: 10,
    marginLeft: 4,
  },
});

/** Memoised: the run re-renders every frame, and this does not move with it. */
export default React.memo(Screen);
