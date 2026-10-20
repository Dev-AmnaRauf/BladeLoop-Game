package com.bladeloop.game

import android.app.Activity
import android.content.ClipData
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.PixelCopy
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.module.annotations.ReactModule
import java.io.File
import java.io.FileOutputStream

/**
 * Shares a score as a picture as well as a line of text.
 *
 * React Native's `Share` only carries text on Android, so a shared score used
 * to arrive as a sentence and a store link and nothing to look at. This draws
 * a card -- the game's own sky, the icon, the score in the game's typeface,
 * the rank, the link -- and hands it to the share sheet with the same message
 * the text-only share sent, so apps that drop the image still get the words.
 *
 * Shared from a run, the card carries what is on screen at that moment: the
 * run the player is proud of. From a page that is not the game (settings, the
 * board) there is no run to show, so the icon's character stands in.
 *
 * Drawn here with a Canvas rather than captured from a React view: finding a
 * view by tag is a different call on each architecture, and this app has
 * already been bitten once by the new one (see `OrientationModule`). A plain
 * legacy module, `isTurboModule = false`, for the same reason.
 */
@ReactModule(name = ShareCardModule.NAME)
class ShareCardModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {

  override fun getName(): String = NAME

  /**
   * `options`: `message` (the text, link included), `title`, `score`, `rank`
   * (0 for none), `link` (printed on the card) and `snapshot` (whether to put
   * the screen on it). Resolves true once the sheet is open -- Android does
   * not say whether anything was sent, which is also what `Share` reports.
   */
  @ReactMethod
  fun share(options: ReadableMap, promise: Promise) {
    val activity = getCurrentActivity()
    if (activity == null) {
      promise.reject("no_activity", "Nothing on screen to share from")
      return
    }
    val snapshot = options.hasKey("snapshot") && options.getBoolean("snapshot")
    activity.runOnUiThread {
      capture(activity, snapshot) { screen ->
        // Drawing and writing a PNG is too slow for the UI thread.
        Thread {
              try {
                val card = draw(activity, options, screen)
                val file = save(card)
                screen?.recycle()
                card.recycle()
                activity.runOnUiThread {
                  try {
                    open(activity, file, options)
                    promise.resolve(true)
                  } catch (e: Exception) {
                    promise.reject("share_failed", e)
                  }
                }
              } catch (e: Exception) {
                promise.reject("share_failed", e)
              }
            }
            .start()
      }
    }
  }

  /**
   * What the window shows now, or null. `PixelCopy` rather than drawing the
   * view tree into a bitmap, because it copies what the compositor actually
   * put up -- hardware layers and all -- where a software redraw can come out
   * blank for them.
   */
  private fun capture(activity: Activity, wanted: Boolean, done: (Bitmap?) -> Unit) {
    val root = activity.window?.decorView
    if (!wanted || root == null || root.width == 0 || root.height == 0) {
      done(null)
      return
    }
    val bitmap = Bitmap.createBitmap(root.width, root.height, Bitmap.Config.ARGB_8888)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      try {
        PixelCopy.request(
            activity.window,
            bitmap,
            { result ->
              if (result == PixelCopy.SUCCESS) done(bitmap)
              else done(redraw(root, bitmap))
            },
            Handler(Looper.getMainLooper()))
        return
      } catch (e: Exception) {
        // The window has no surface yet; fall through to the redraw.
      }
    }
    done(redraw(root, bitmap))
  }

  private fun redraw(root: android.view.View, bitmap: Bitmap): Bitmap? =
      try {
        root.draw(Canvas(bitmap))
        bitmap
      } catch (e: Exception) {
        bitmap.recycle()
        null
      }

  /** The card itself. */
  private fun draw(activity: Activity, options: ReadableMap, screen: Bitmap?): Bitmap {
    val score = if (options.hasKey("score")) options.getInt("score") else 0
    val rank = if (options.hasKey("rank")) options.getInt("rank") else 0
    val link = if (options.hasKey("link")) options.getString("link") ?: "" else ""

    // Tall enough for a phone's feed and the chat apps' previews alike.
    val w = CARD_W
    val shotH = if (screen != null) (SHOT_W * screen.height / screen.width) else HERO
    val h = PAD + HEADER + GAP + shotH + GAP + SCORE_BLOCK + FOOTER + PAD
    val card = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    val c = Canvas(card)

    val face =
        try {
          Typeface.createFromAsset(activity.assets, "fonts/LilitaOne-Regular.ttf")
        } catch (e: Exception) {
          Typeface.DEFAULT_BOLD
        }
    val paint = Paint(Paint.ANTI_ALIAS_FLAG)

    // The sky: `bgTop` to `bgBot` from the theme.
    paint.shader = LinearGradient(0f, 0f, 0f, h.toFloat(), BG_TOP, BG_BOT, Shader.TileMode.CLAMP)
    c.drawRect(0f, 0f, w.toFloat(), h.toFloat(), paint)
    paint.shader = null

    // Header: icon and wordmark.
    var y = PAD.toFloat()
    val icon = ContextCompat.getDrawable(activity, R.mipmap.ic_launcher)
    if (icon != null) {
      icon.setBounds(PAD, y.toInt(), PAD + HEADER, y.toInt() + HEADER)
      icon.draw(c)
    }
    paint.typeface = face
    paint.textSize = 76f
    paint.color = INK
    val wordX = PAD + HEADER + 28f
    val base = y + HEADER / 2f + 26f
    c.drawText("BLADE", wordX, base, paint)
    paint.color = BLADE
    c.drawText("LOOP", wordX + paint.measureText("BLADE "), base, paint)

    // The run, framed like one of the game's cards, or the character if
    // there is no run to show.
    y += HEADER + GAP
    val frame = RectF(PAD.toFloat(), y, (w - PAD).toFloat(), y + shotH)
    paint.color = CARD
    c.drawRoundRect(frame, RADIUS, RADIUS, paint)
    if (screen != null) {
      val clip = Path().apply { addRoundRect(frame, RADIUS, RADIUS, Path.Direction.CW) }
      c.save()
      c.clipPath(clip)
      c.drawBitmap(screen, null, frame, Paint(Paint.FILTER_BITMAP_FLAG))
      c.restore()
    } else if (icon != null) {
      val side = (shotH * 0.8f).toInt()
      val left = (w - side) / 2
      val top = (y + (shotH - side) / 2f).toInt()
      icon.setBounds(left, top, left + side, top + side)
      icon.draw(c)
    }
    paint.style = Paint.Style.STROKE
    paint.strokeWidth = 6f
    paint.color = GOLD
    c.drawRoundRect(frame, RADIUS, RADIUS, paint)
    paint.style = Paint.Style.FILL

    // The score, big, in gold -- the part worth reading.
    y += shotH + GAP
    paint.textAlign = Paint.Align.CENTER
    paint.color = INK_SOFT
    paint.textSize = 44f
    c.drawText(if (score > 0) "MY SCORE" else "CAN YOU THREAD THE BLADES?", w / 2f, y + 44f, paint)
    if (score > 0) {
      paint.color = GOLD
      paint.textSize = 150f
      c.drawText(score.toString(), w / 2f, y + 44f + 150f, paint)
    }
    if (rank > 0) {
      paint.color = LIVE
      paint.textSize = 48f
      c.drawText("#$rank IN THE WORLD", w / 2f, y + SCORE_BLOCK - 14f, paint)
    }

    // The ask, and where to go.
    y += SCORE_BLOCK
    val pill = RectF(PAD + 60f, y + 10f, w - PAD - 60f, y + 110f)
    paint.color = BLADE
    c.drawRoundRect(pill, 50f, 50f, paint)
    paint.color = WHITE
    paint.textSize = 50f
    c.drawText(if (score > 0) "BEAT MY SCORE" else "PLAY FREE", w / 2f, pill.centerY() + 18f, paint)
    if (link.isNotEmpty()) {
      paint.typeface = Typeface.DEFAULT
      paint.color = INK_SOFT
      paint.textSize = 26f
      c.drawText(fit(link, paint, w - 2f * PAD), w / 2f, y + 160f, paint)
    }
    return card
  }

  /** A link too long for the card loses its middle rather than its host. */
  private fun fit(text: String, paint: Paint, room: Float): String {
    if (paint.measureText(text) <= room) return text
    var cut = text
    while (cut.length > 8 && paint.measureText("$cut…") > room) cut = cut.dropLast(1)
    return "$cut…"
  }

  /** One file, overwritten each time: nobody needs yesterday's card. */
  private fun save(card: Bitmap): File {
    val dir = File(reactApplicationContext.cacheDir, "share").apply { mkdirs() }
    val file = File(dir, "bladeloop-score.png")
    FileOutputStream(file).use { card.compress(Bitmap.CompressFormat.PNG, 100, it) }
    return file
  }

  private fun open(activity: Activity, file: File, options: ReadableMap) {
    val uri =
        FileProvider.getUriForFile(activity, "${activity.packageName}.sharecard", file)
    val message = if (options.hasKey("message")) options.getString("message") else null
    val title = if (options.hasKey("title")) options.getString("title") else null
    val send =
        Intent(Intent.ACTION_SEND).apply {
          type = "image/png"
          putExtra(Intent.EXTRA_STREAM, uri)
          if (message != null) putExtra(Intent.EXTRA_TEXT, message)
          if (title != null) putExtra(Intent.EXTRA_SUBJECT, title)
          // The ClipData is what lets the sheet show the picture as a preview
          // and pass the read grant on to whichever app is picked.
          clipData = ClipData.newRawUri(title ?: "BladeLoop", uri)
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
    activity.startActivity(Intent.createChooser(send, title))
  }

  companion object {
    const val NAME = "NativeShareCard"

    private const val CARD_W = 1200
    private const val PAD = 56
    private const val HEADER = 120
    private const val GAP = 44
    private const val SHOT_W = CARD_W - 2 * PAD
    private const val HERO = 520
    private const val SCORE_BLOCK = 270
    private const val FOOTER = 190
    private const val RADIUS = 36f

    // From `src/ui/theme.tsx`.
    private const val BG_TOP = 0xFF221C4C.toInt()
    private const val BG_BOT = 0xFF2E2248.toInt()
    private const val CARD = 0xFF1A1630.toInt()
    private const val INK = 0xFFF3EEFF.toInt()
    private const val INK_SOFT = 0xFFB9A2EC.toInt()
    private const val BLADE = 0xFFFF4D6D.toInt()
    private const val GOLD = 0xFFFFC93C.toInt()
    private const val LIVE = 0xFF2BE0A8.toInt()
    private const val WHITE = 0xFFFFFFFF.toInt()
  }
}
