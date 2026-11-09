#!/usr/bin/env python3
import os
import math
import subprocess
import tempfile
from PIL import Image, ImageDraw, ImageFont

WIDTH = 1280
HEIGHT = 720
FPS = 30

FONT_PATH_REGULAR = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
FONT_PATH_BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

font_xs = ImageFont.truetype(FONT_PATH_REGULAR, 11)
font_sm = ImageFont.truetype(FONT_PATH_REGULAR, 13)
font_sm_bold = ImageFont.truetype(FONT_PATH_BOLD, 13)
font_base = ImageFont.truetype(FONT_PATH_REGULAR, 15)
font_base_bold = ImageFont.truetype(FONT_PATH_BOLD, 15)
font_lg = ImageFont.truetype(FONT_PATH_BOLD, 18)
font_xl = ImageFont.truetype(FONT_PATH_BOLD, 24)
font_title = ImageFont.truetype(FONT_PATH_BOLD, 32)
font_hero = ImageFont.truetype(FONT_PATH_BOLD, 44)

STICKY_COLORS = {
    'event': {'bg': (234, 88, 12), 'fg': (255, 255, 255), 'label': 'DOMAIN EVENT'},
    'command': {'bg': (37, 99, 235), 'fg': (255, 255, 255), 'label': 'COMMAND'},
    'policy': {'bg': (147, 51, 234), 'fg': (255, 255, 255), 'label': 'POLICY'},
    'aggregate': {'bg': (202, 138, 4), 'fg': (255, 255, 255), 'label': 'AGGREGATE'},
    'hotspot': {'bg': (225, 29, 72), 'fg': (255, 255, 255), 'label': 'HOTSPOT'},
    'readmodel': {'bg': (22, 163, 74), 'fg': (255, 255, 255), 'label': 'READ MODEL'},
    'user': {'bg': (234, 179, 8), 'fg': (15, 23, 42), 'label': 'USER / ROLE'},
    'system': {'bg': (219, 39, 119), 'fg': (255, 255, 255), 'label': 'EXT SYSTEM'},
    'opportunity': {'bg': (5, 150, 105), 'fg': (255, 255, 255), 'label': 'OPPORTUNITY'},
    'value': {'bg': (13, 148, 136), 'fg': (255, 255, 255), 'label': 'CORE VALUE'},
}

def ease_out_cubic(t):
    return 1 - math.pow(1 - t, 3)

def ease_in_out(t):
    if t < 0.5:
        return 4 * t * t * t
    return 1 - math.pow(-2 * t + 2, 3) / 2

def draw_rounded_rect(draw, bbox, radius, fill, outline=None, width=1):
    x0, y0, x1, y1 = bbox
    draw.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=fill, outline=outline, width=width)

def draw_canvas_grid(draw, width, height, offset_x=0, offset_y=0, spacing=32):
    start_x = int(offset_x) % spacing
    start_y = int(offset_y) % spacing
    for x in range(start_x, width, spacing):
        for y in range(start_y, height, spacing):
            draw.point((x, y), fill=(30, 41, 59))

def draw_header(draw, title_text, format_name, timer_str="12:45", voting_active=False, call_active=True, following_name=None):
    # Top navbar
    draw.rectangle([0, 0, WIDTH, 54], fill=(15, 23, 42), outline=(30, 41, 59), width=1)
    # Brand logo
    draw.text((20, 16), "⚡ EventStormer", font=font_lg, fill=(255, 255, 255))
    draw_rounded_rect(draw, [180, 17, 275, 37], 10, fill=(245, 158, 11, 40), outline=(245, 158, 11), width=1)
    draw.text((192, 21), "Brandolini DDD", font=font_xs, fill=(251, 191, 36))

    # Workshop Title
    draw.text((290, 18), title_text[:28], font=font_base_bold, fill=(241, 245, 249))

    # Format Badge
    draw_rounded_rect(draw, [520, 17, 650, 37], 10, fill=(30, 58, 138), outline=(59, 130, 246), width=1)
    draw.text((532, 21), format_name, font=font_xs, fill=(147, 197, 253))

    # Timer Pill
    draw_rounded_rect(draw, [660, 17, 745, 37], 10, fill=(20, 83, 45) if not voting_active else (153, 27, 27), outline=(34, 197, 94) if not voting_active else (239, 68, 68), width=1)
    draw.text((670, 21), f"⏱️ {timer_str}", font=font_xs, fill=(240, 253, 244))

    # Breakouts Button
    draw_rounded_rect(draw, [755, 17, 835, 37], 10, fill=(30, 41, 59), outline=(51, 65, 85), width=1)
    draw.text((765, 21), "Breakouts", font=font_xs, fill=(203, 213, 225))

    # Call Button (Active Emerald Pill)
    if call_active:
        draw_rounded_rect(draw, [845, 17, 915, 37], 10, fill=(5, 150, 105), outline=(52, 211, 153), width=1)
        draw.ellipse([853, 23, 859, 29], fill=(255, 255, 255))
        draw.text((865, 21), "Call (3)", font=font_xs, fill=(255, 255, 255))
    else:
        draw_rounded_rect(draw, [845, 17, 905, 37], 10, fill=(30, 41, 59), outline=(51, 65, 85), width=1)
        draw.text((858, 21), "Call", font=font_xs, fill=(148, 163, 184))

    # Voting Mode Badge
    if voting_active:
        draw_rounded_rect(draw, [925, 17, 1005, 37], 10, fill=(136, 19, 55), outline=(244, 63, 94), width=1)
        draw.text((934, 21), "🗳️ Voting", font=font_xs, fill=(255, 228, 230))

    # Peer Avatars
    avatars = [("AL", (14, 165, 233)), ("SA", (249, 115, 22)), ("EL", (168, 85, 247))]
    start_av_x = 1015
    for idx, (initials, color) in enumerate(avatars):
        ax = start_av_x + idx * 26
        draw.ellipse([ax, 16, ax + 22, 38], fill=color, outline=(30, 41, 59), width=1)
        draw.text((ax + 4, 21), initials, font=font_xs, fill=(255, 255, 255))

    # Actions: Export & Share
    draw_rounded_rect(draw, [1105, 16, 1175, 38], 6, fill=(30, 41, 59), outline=(51, 65, 85), width=1)
    draw.text((1120, 21), "Export", font=font_xs, fill=(226, 232, 240))
    draw_rounded_rect(draw, [1185, 16, 1255, 38], 6, fill=(217, 119, 6), outline=None)
    draw.text((1200, 21), "Share", font=font_xs, fill=(15, 23, 42))

    # Following Banner (if following someone)
    if following_name:
        fw = len(following_name) * 7 + 130
        fx = (WIDTH - fw) // 2
        draw_rounded_rect(draw, [fx, 62, fx + fw, 90], 14, fill=(79, 70, 229, 230), outline=(129, 140, 248), width=1)
        draw.text((fx + 12, 68), f"👀 Following {following_name}   ✕ Stop", font=font_xs, fill=(255, 255, 255))

def draw_videocall_dock(draw, t, show_effects=False):
    dock_x = WIDTH - 270
    dock_y = 66
    dock_h = 175 if show_effects else 115
    draw_rounded_rect(draw, [dock_x, dock_y, dock_x + 250, dock_y + dock_h], 16, fill=(15, 23, 42, 235), outline=(51, 65, 85), width=1)

    # Title bar
    draw.ellipse([dock_x + 14, dock_y + 11, dock_x + 20, dock_y + 17], fill=(52, 211, 153))
    draw_rounded_rect(draw, [dock_x + 26, dock_y + 7, dock_x + 120, dock_y + 23], 8, fill=(30, 58, 138, 180), outline=(59, 130, 246), width=1)
    draw.text((dock_x + 34, dock_y + 9), "Main Room", font=font_xs, fill=(147, 197, 253))
    draw.text((dock_x + 130, dock_y + 9), "👥 3 in call", font=font_xs, fill=(148, 163, 184))

    # Bubbles row
    # Local Alex (Cyberpunk + Crown)
    draw.ellipse([dock_x + 16, dock_y + 32, dock_x + 64, dock_y + 80], fill=(14, 165, 233), outline=(34, 211, 238), width=2)
    draw.text((dock_x + 30, dock_y + 50), "AL", font=font_xs, fill=(255, 255, 255))
    draw.text((dock_x + 30, dock_y + 24), "👑", font=font_xs, fill=(255, 255, 255))

    # Sarah (speaking, pulsing emerald ring)
    pulse = int(3 * math.sin(t * 8))
    draw.ellipse([dock_x + 76 - pulse, dock_y + 32 - pulse, dock_x + 124 + pulse, dock_y + 80 + pulse], outline=(52, 211, 153), width=3)
    draw.ellipse([dock_x + 76, dock_y + 32, dock_x + 124, dock_y + 80], fill=(249, 115, 22))
    draw.text((dock_x + 90, dock_y + 50), "SA", font=font_xs, fill=(255, 255, 255))

    # Elena (Sunset aura)
    draw.ellipse([dock_x + 136, dock_y + 32, dock_x + 184, dock_y + 80], fill=(168, 85, 247), outline=(251, 191, 36), width=2)
    draw.text((dock_x + 150, dock_y + 50), "EL", font=font_xs, fill=(255, 255, 255))

    # Controls bar
    draw_rounded_rect(draw, [dock_x + 18, dock_y + 88, dock_x + 48, dock_y + 108], 6, fill=(30, 41, 59))
    draw.text((dock_x + 25, dock_y + 92), "🎤", font=font_xs, fill=(255, 255, 255))
    draw_rounded_rect(draw, [dock_x + 56, dock_y + 88, dock_x + 86, dock_y + 108], 6, fill=(30, 41, 59))
    draw.text((dock_x + 63, dock_y + 92), "📹", font=font_xs, fill=(255, 255, 255))
    draw_rounded_rect(draw, [dock_x + 94, dock_y + 88, dock_x + 124, dock_y + 108], 6, fill=(30, 41, 59))
    draw.text((dock_x + 101, dock_y + 92), "🖥️", font=font_xs, fill=(255, 255, 255))
    # Sparkles (Around effects)
    draw_rounded_rect(draw, [dock_x + 132, dock_y + 88, dock_x + 162, dock_y + 108], 6, fill=(219, 39, 119) if show_effects else (30, 41, 59))
    draw.text((dock_x + 139, dock_y + 92), "✨", font=font_xs, fill=(255, 255, 255))
    # Leave
    draw_rounded_rect(draw, [dock_x + 170, dock_y + 88, dock_x + 200, dock_y + 108], 6, fill=(225, 29, 72))
    draw.text((dock_x + 177, dock_y + 92), "📞", font=font_xs, fill=(255, 255, 255))

    # Around Effects Popover if show_effects
    if show_effects:
        draw_rounded_rect(draw, [dock_x + 10, dock_y + 118, dock_x + 240, dock_y + 166], 8, fill=(2, 6, 23, 240), outline=(219, 39, 119), width=1)
        draw.text((dock_x + 16, dock_y + 124), "✨ Around Effects: Cyberpunk • Cyan • 👑", font=font_xs, fill=(244, 114, 182))
        draw.text((dock_x + 16, dock_y + 144), "Filters: Noir • Sunset • Phosphor • Cosmic", font=font_xs, fill=(148, 163, 184))

def draw_facilitator_sidebar(draw, active_phase_idx, phases_list):
    draw.rectangle([0, 54, 240, HEIGHT], fill=(11, 17, 32), outline=(30, 41, 59), width=1)
    draw.text((16, 70), "FACILITATOR GUIDE", font=font_xs, fill=(148, 163, 184))

    for idx, (title, desc) in enumerate(phases_list):
        py = 95 + idx * 62
        is_active = (idx == active_phase_idx)
        is_passed = (idx < active_phase_idx)

        bg = (30, 41, 59, 180) if is_active else ((15, 23, 42) if not is_passed else (17, 24, 39))
        border = (99, 102, 241) if is_active else ((51, 65, 85) if not is_passed else (34, 197, 94))
        draw_rounded_rect(draw, [12, py, 228, py + 52], 8, fill=bg, outline=border, width=2 if is_active else 1)

        step_col = (99, 102, 241) if is_active else ((100, 116, 139) if not is_passed else (34, 197, 94))
        draw.ellipse([20, py + 16, 40, py + 36], fill=step_col)
        badge_text = "✓" if is_passed else str(idx + 1)
        draw.text((27, py + 19), badge_text, font=font_xs, fill=(255, 255, 255))

        tcol = (255, 255, 255) if is_active else (203, 213, 225)
        draw.text((48, py + 10), title, font=font_sm_bold if is_active else font_sm, fill=tcol)
        draw.text((48, py + 28), desc[:24] + "...", font=font_xs, fill=(148, 163, 184))

def draw_sticky_palette(draw):
    px = 300
    py = HEIGHT - 52
    draw_rounded_rect(draw, [px, py, px + 680, py + 42], 12, fill=(15, 23, 42), outline=(51, 65, 85), width=1)
    types = [
        ("Event", (234, 88, 12)),
        ("Command", (37, 99, 235)),
        ("Policy", (147, 51, 234)),
        ("Aggregate", (202, 138, 4)),
        ("Hotspot", (225, 29, 72)),
        ("ReadModel", (22, 163, 74)),
        ("User", (234, 179, 8)),
        ("System", (219, 39, 119)),
    ]
    for idx, (name, col) in enumerate(types):
        bx = px + 12 + idx * 82
        draw.rectangle([bx, py + 8, bx + 16, py + 24], fill=col)
        draw.text((bx + 22, py + 10), name, font=font_xs, fill=(226, 232, 240))

def draw_sticky_note(img, x, y, stype, text, votes=0, rotation=0, scale=1.0):
    cfg = STICKY_COLORS.get(stype, STICKY_COLORS['event'])
    w = int(140 * scale)
    h = int(110 * scale)

    s_img = Image.new('RGBA', (w + 16, h + 16), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(s_img)

    s_draw.rectangle([6, 6, w + 6, h + 6], fill=(0, 0, 0, 70))
    s_draw.rectangle([2, 2, w + 2, h + 2], fill=cfg['bg'], outline=(255, 255, 255, 100), width=1)
    s_draw.text((8, 6), cfg['label'], font=font_xs, fill=(255, 255, 255, 180))

    words = text.split(' ')
    lines = []
    cur = ""
    for word in words:
        if len(cur + " " + word) < 14:
            cur = (cur + " " + word).strip()
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)

    for l_idx, line in enumerate(lines[:3]):
        s_draw.text((8, 26 + l_idx * 16), line, font=font_sm_bold, fill=cfg['fg'])

    if votes > 0:
        s_draw.ellipse([w - 24, h - 24, w - 4, h - 4], fill=(225, 29, 72))
        s_draw.text((w - 18, h - 22), str(votes), font=font_xs, fill=(255, 255, 255))

    if rotation != 0:
        s_img = s_img.rotate(rotation, resample=Image.BICUBIC, expand=True)

    img.paste(s_img, (int(x), int(y)), s_img)

def draw_cursor(draw, x, y, name, color, is_speaking=False, aura_color=None, reaction=None, is_following=False):
    # Round webcam circle above name tag
    cx = int(x - 2)
    cy = int(y - 28)
    r = 13

    if is_speaking:
        draw.ellipse([cx - r - 3, cy - r - 3, cx + r + 3, cy + r + 3], outline=(52, 211, 153), width=3)
    elif aura_color:
        draw.ellipse([cx - r - 2, cy - r - 2, cx + r + 2, cy + r + 2], outline=aura_color, width=2)
    else:
        draw.ellipse([cx - r - 1, cy - r - 1, cx + r + 1, cy + r + 1], outline=(30, 41, 59), width=1)

    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)
    initials = "".join([part[0] for part in name.split() if part])[:2].upper()
    draw.text((cx - 7, cy - 6), initials, font=font_xs, fill=(255, 255, 255))

    if reaction:
        draw.text((cx - 6, cy - 24), reaction, font=font_xs, fill=(255, 255, 255))

    # Pointer triangle
    points = [(int(x), int(y)), (int(x + 14), int(y + 10)), (int(x + 8), int(y + 14)), (int(x + 12), int(y + 22)), (int(x + 7), int(y + 24)), (int(x + 4), int(y + 15)), (int(x), int(y + 18))]
    draw.polygon(points, fill=color, outline=(255, 255, 255))

    # Name tag
    tag_text = name + (" • Following" if is_following else "")
    tag_w = len(tag_text) * 7 + 14
    draw_rounded_rect(draw, [int(x + 14), int(y + 14), int(x + 14 + tag_w), int(y + 32)], 4, fill=color)
    draw.text((int(x + 18), int(y + 16)), tag_text, font=font_xs, fill=(255, 255, 255))

def draw_pivotal_line(draw, x, name):
    for y in range(60, HEIGHT - 60, 10):
        draw.line([(x, y), (x, y + 5)], fill=(239, 68, 68), width=3)
    draw_rounded_rect(draw, [x - 70, 70, x + 70, 96], 6, fill=(153, 27, 27), outline=(239, 68, 68), width=1)
    draw.text((x - 62, 75), f"🏁 {name}", font=font_xs, fill=(255, 255, 255))

def draw_swimlane(draw, y, height, name, color):
    draw.rectangle([240, y, WIDTH, y + height], fill=(color[0], color[1], color[2], 25), outline=(color[0], color[1], color[2], 70), width=1)
    draw_rounded_rect(draw, [250, y + 10, 390, y + 34], 6, fill=(30, 41, 59), outline=color, width=1)
    draw.text((262, y + 14), f"📂 {name}", font=font_xs, fill=(241, 245, 249))

def render_big_picture_video(output_path):
    print(f"Rendering Big Picture Walkthrough to {output_path}...")
    frames_dir = tempfile.mkdtemp()
    num_frames = FPS * 12  # 12 seconds
    phases = [
        ("1. Chaotic Generation", "Brainstorm orange events freely"),
        ("2. Enforce Timeline", "Sort chronologically left to right"),
        ("3. Reverse Narrative", "Find missing events & hotspots"),
        ("4. Roles & Systems", "Map actors and external APIs"),
        ("5. Bounded Contexts", "Cluster into bounded swimlanes"),
    ]

    events_data = [
        {"text": "Order Placed", "tx": 300, "ty": 200, "fx": 320, "fy": 180},
        {"text": "Payment Authorized", "tx": 470, "ty": 320, "fx": 460, "fy": 180},
        {"text": "Inventory Reserved", "tx": 620, "ty": 160, "fx": 600, "fy": 180},
        {"text": "Parcel Dispatched", "tx": 800, "ty": 340, "fx": 780, "fy": 180},
        {"text": "Delivery Signed", "tx": 980, "ty": 220, "fx": 940, "fy": 180},
        {"text": "Invoice Sent", "tx": 700, "ty": 420, "fx": 620, "fy": 340},
    ]

    for frame_idx in range(num_frames):
        t = frame_idx / float(FPS)
        img = Image.new('RGB', (WIDTH, HEIGHT), color=(9, 13, 22))
        draw = ImageDraw.Draw(img)
        draw_canvas_grid(draw, WIDTH, HEIGHT)

        active_phase = 0
        if t >= 3.0: active_phase = 1
        if t >= 6.0: active_phase = 2
        if t >= 8.5: active_phase = 3
        if t >= 10.5: active_phase = 4

        if t >= 8.5:
            draw_swimlane(draw, 140, 180, "Customer Commerce", (59, 130, 246))
            draw_swimlane(draw, 340, 180, "Logistics & Fulfillment", (16, 185, 129))

        if t >= 3.0:
            draw_pivotal_line(draw, 720, "Pivotal: Order Shipped")

        for e_idx, ev in enumerate(events_data):
            spawn_time = e_idx * 0.4
            if t < spawn_time:
                continue
            if t < 3.0:
                pop = min(1.0, (t - spawn_time) * 3)
                draw_sticky_note(img, ev['tx'], ev['ty'], 'event', ev['text'], scale=pop)
            else:
                move_prog = ease_in_out(min(1.0, (t - 3.0) / 1.5))
                cur_x = ev['tx'] + (ev['fx'] - ev['tx']) * move_prog
                cur_y = ev['ty'] + (ev['fy'] - ev['ty']) * move_prog
                draw_sticky_note(img, cur_x, cur_y, 'event', ev['text'], scale=1.0)

        if t >= 6.0:
            pop_h = min(1.0, (t - 6.0) * 3)
            votes_1 = min(5, int((t - 6.5) * 3)) if t >= 6.5 else 0
            votes_2 = min(3, int((t - 7.0) * 2)) if t >= 7.0 else 0
            draw_sticky_note(img, 450, 310, 'hotspot', 'Payment Gateway Timeout Spike', votes=votes_1, rotation=-6, scale=pop_h)
            draw_sticky_note(img, 760, 310, 'hotspot', 'Manual Picking Bottleneck', votes=votes_2, rotation=5, scale=pop_h)

        if t >= 8.5:
            draw_sticky_note(img, 320, 260, 'user', 'Online Shopper', scale=1.0)
            draw_sticky_note(img, 920, 260, 'system', 'Courier DHL API', scale=1.0)

        if t >= 10.5:
            draw_sticky_note(img, 580, 520, 'opportunity', 'Automated 1-Click Retry', scale=1.0)

        # Cursors with webcam bubbles
        c1_x = 350 + math.sin(t * 1.5) * 180 + t * 25
        c1_y = 220 + math.cos(t * 2.0) * 80
        draw_cursor(draw, c1_x, c1_y, "Sarah (Lead Domain Expert)", (249, 115, 22), is_speaking=(4.0 <= t < 8.0), reaction="💡")

        c2_x = 750 + math.cos(t * 1.8) * 140
        c2_y = 300 + math.sin(t * 1.4) * 90
        draw_cursor(draw, c2_x, c2_y, "Alex (System Architect)", (14, 165, 233), aura_color=(34, 211, 238), reaction="👑")

        draw_facilitator_sidebar(draw, active_phase, phases)
        timer_str = f"14:{max(0, 50 - int(t * 3)):02d}"
        draw_header(draw, "Global Retail Big Picture Session", "Big Picture", timer_str=timer_str, voting_active=(6.0 <= t < 8.5), call_active=True)
        draw_sticky_palette(draw)

        img.save(os.path.join(frames_dir, f"frame_{frame_idx:04d}.png"))

    cmd = [
        'ffmpeg', '-y',
        '-framerate', str(FPS),
        '-i', os.path.join(frames_dir, 'frame_%04d.png'),
        '-f', 'lavfi', '-i', 'aevalsrc=sin(2*PI*t*220)*0.015*exp(-mod(t\\,2.0)*2)+sin(2*PI*t*330)*0.01*exp(-mod(t+1.0\\,2.0)*2):s=44100',
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'fast', '-crf', '22',
        '-c:a', 'aac', '-b:a', '128k', '-shortest',
        output_path
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for f in os.listdir(frames_dir):
        os.remove(os.path.join(frames_dir, f))
    os.rmdir(frames_dir)
    print(f"Successfully generated {output_path}")

def render_process_modelling_video(output_path):
    print(f"Rendering Process Modelling Walkthrough to {output_path}...")
    frames_dir = tempfile.mkdtemp()
    num_frames = FPS * 12  # 12 seconds
    phases = [
        ("1. Process Scope", "Define flow trigger and end goal"),
        ("2. Happy Path Flow", "Command -> Aggregate -> Event"),
        ("3. Read Models & UI", "Data views and decision screens"),
        ("4. Business Policies", "Whenever Event -> Then Command"),
        ("5. Exceptions & Hotspots", "Failure modes and fallbacks"),
    ]

    for frame_idx in range(num_frames):
        t = frame_idx / float(FPS)
        img = Image.new('RGB', (WIDTH, HEIGHT), color=(9, 13, 22))
        draw = ImageDraw.Draw(img)
        draw_canvas_grid(draw, WIDTH, HEIGHT)

        active_phase = 0
        if t >= 2.5: active_phase = 1
        if t >= 5.0: active_phase = 2
        if t >= 7.5: active_phase = 3
        if t >= 10.0: active_phase = 4

        draw_swimlane(draw, 140, 280, "Order-To-Cash Process Flow", (147, 51, 234))

        if t >= 1.0:
            draw_sticky_note(img, 280, 180, 'user', 'Buyer (Customer)', scale=1.0)
            draw_sticky_note(img, 280, 280, 'command', 'Submit Order', scale=1.0)

        if t >= 2.5:
            draw_sticky_note(img, 430, 280, 'aggregate', 'Order Aggregate', scale=1.0)
            draw_sticky_note(img, 580, 280, 'event', 'Order Placed', scale=1.0)
            draw.line([(390, 310), (420, 310)], fill=(99, 102, 241), width=2)
            draw.line([(540, 310), (570, 310)], fill=(234, 88, 12), width=2)

        if t >= 5.0:
            draw_sticky_note(img, 280, 440, 'readmodel', 'Inventory Catalog View', scale=1.0)
            draw_sticky_note(img, 580, 440, 'readmodel', 'Order Summary Screen', scale=1.0)
            draw.line([(330, 430), (330, 370)], fill=(34, 197, 94), width=2)

        if t >= 7.5:
            draw_sticky_note(img, 730, 280, 'policy', 'Whenever Order Placed -> Reserve Stock', scale=1.0)
            draw_sticky_note(img, 880, 280, 'command', 'Reserve Warehouse Items', scale=1.0)
            draw_sticky_note(img, 1030, 280, 'event', 'Stock Allocated', scale=1.0)
            draw.line([(690, 310), (720, 310)], fill=(147, 51, 234), width=2)
            draw.line([(840, 310), (870, 310)], fill=(37, 99, 235), width=2)
            draw.line([(990, 310), (1020, 310)], fill=(234, 88, 12), width=2)

        if t >= 10.0:
            draw_sticky_note(img, 880, 420, 'hotspot', 'Out of Stock Race Condition', votes=4, rotation=5, scale=1.0)
            draw_sticky_note(img, 1030, 420, 'event', 'Stock Reservation Failed', scale=1.0)

        # Cursors with webcam bubbles
        c1_x = 420 + math.sin(t * 1.6) * 120 + t * 30
        c1_y = 260 + math.cos(t * 2.1) * 60
        draw_cursor(draw, c1_x, c1_y, "Elena (Process Lead)", (168, 85, 247), is_speaking=(3.0 <= t < 7.0), reaction="⚡")

        c2_x = 650 + math.cos(t * 1.3) * 160
        c2_y = 340 + math.sin(t * 1.7) * 70
        draw_cursor(draw, c2_x, c2_y, "Marc (Backend Dev)", (34, 197, 94), aura_color=(52, 211, 153), reaction="🚀")

        draw_facilitator_sidebar(draw, active_phase, phases)
        timer_str = f"22:{max(0, 45 - int(t * 2)):02d}"
        draw_header(draw, "Order Fulfillment Process Deep Dive", "Process Modelling", timer_str=timer_str, voting_active=(10.0 <= t), call_active=True)
        draw_sticky_palette(draw)

        img.save(os.path.join(frames_dir, f"frame_{frame_idx:04d}.png"))

    cmd = [
        'ffmpeg', '-y',
        '-framerate', str(FPS),
        '-i', os.path.join(frames_dir, 'frame_%04d.png'),
        '-f', 'lavfi', '-i', 'aevalsrc=sin(2*PI*t*260)*0.015*exp(-mod(t\\,2.0)*2)+sin(2*PI*t*390)*0.01*exp(-mod(t+1.0\\,2.0)*2):s=44100',
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'fast', '-crf', '22',
        '-c:a', 'aac', '-b:a', '128k', '-shortest',
        output_path
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for f in os.listdir(frames_dir):
        os.remove(os.path.join(frames_dir, f))
    os.rmdir(frames_dir)
    print(f"Successfully generated {output_path}")

def render_software_design_video(output_path):
    print(f"Rendering Software Design Walkthrough to {output_path}...")
    frames_dir = tempfile.mkdtemp()
    num_frames = FPS * 12  # 12 seconds
    phases = [
        ("1. Bounded Contexts", "Define aggregate transactional roots"),
        ("2. Invariants & Rules", "Identify consistency boundaries"),
        ("3. Command Handlers", "Map mutation routing and validation"),
        ("4. CQRS Read Models", "Define asynchronous projections"),
        ("5. Event Publishing", "Cross-context integration contracts"),
    ]

    for frame_idx in range(num_frames):
        t = frame_idx / float(FPS)
        img = Image.new('RGB', (WIDTH, HEIGHT), color=(9, 13, 22))
        draw = ImageDraw.Draw(img)
        draw_canvas_grid(draw, WIDTH, HEIGHT)

        active_phase = 0
        if t >= 2.5: active_phase = 1
        if t >= 5.0: active_phase = 2
        if t >= 7.5: active_phase = 3
        if t >= 10.0: active_phase = 4

        draw_swimlane(draw, 140, 240, "Order Management Bounded Context", (59, 130, 246))
        draw_swimlane(draw, 400, 240, "Billing & Payment Bounded Context", (16, 185, 129))

        if t >= 1.0:
            draw_sticky_note(img, 280, 200, 'aggregate', 'Order Aggregate Root', scale=1.0)
            draw_sticky_note(img, 280, 460, 'aggregate', 'Payment Transaction Root', scale=1.0)

        if t >= 2.5:
            draw_sticky_note(img, 430, 200, 'policy', 'Invariant: Max order items <= 50', scale=1.0)
            draw_sticky_note(img, 430, 460, 'policy', 'Invariant: Currency must match ISO-4217', scale=1.0)

        if t >= 5.0:
            draw_sticky_note(img, 580, 200, 'command', 'CreateOrderCmd', scale=1.0)
            draw_sticky_note(img, 730, 200, 'event', 'OrderCreatedEvt', scale=1.0)
            draw_sticky_note(img, 580, 460, 'command', 'AuthorizeCardCmd', scale=1.0)
            draw_sticky_note(img, 730, 460, 'event', 'CardAuthorizedEvt', scale=1.0)

        if t >= 7.5:
            draw_sticky_note(img, 880, 200, 'readmodel', 'ActiveOrdersProjection', scale=1.0)
            draw_sticky_note(img, 880, 460, 'readmodel', 'BillingLedgerView', scale=1.0)

        if t >= 10.0:
            draw_sticky_note(img, 1030, 320, 'system', 'Kafka Event Bus Broker', scale=1.0)
            draw.line([(840, 240), (1020, 340)], fill=(234, 88, 12), width=2)
            draw.line([(840, 500), (1020, 380)], fill=(234, 88, 12), width=2)

        # Cursors with webcam bubbles
        c1_x = 520 + math.cos(t * 1.7) * 140
        c1_y = 230 + math.sin(t * 1.5) * 80
        draw_cursor(draw, c1_x, c1_y, "David (Software Architect)", (14, 165, 233), aura_color=(34, 211, 238), reaction="👑")

        c2_x = 780 + math.sin(t * 1.4) * 110
        c2_y = 380 + math.cos(t * 1.8) * 70
        draw_cursor(draw, c2_x, c2_y, "Sarah (Lead Engineer)", (249, 115, 22), is_speaking=(4.0 <= t < 9.0), reaction="💡")

        draw_facilitator_sidebar(draw, active_phase, phases)
        timer_str = f"18:{max(0, 55 - int(t * 2)):02d}"
        draw_header(draw, "Microservices & Aggregate Boundaries", "Software Design", timer_str=timer_str, voting_active=False, call_active=True)
        draw_sticky_palette(draw)

        img.save(os.path.join(frames_dir, f"frame_{frame_idx:04d}.png"))

    cmd = [
        'ffmpeg', '-y',
        '-framerate', str(FPS),
        '-i', os.path.join(frames_dir, 'frame_%04d.png'),
        '-f', 'lavfi', '-i', 'aevalsrc=sin(2*PI*t*300)*0.015*exp(-mod(t\\,2.0)*2)+sin(2*PI*t*450)*0.01*exp(-mod(t+1.0\\,2.0)*2):s=44100',
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'fast', '-crf', '22',
        '-c:a', 'aac', '-b:a', '128k', '-shortest',
        output_path
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for f in os.listdir(frames_dir):
        os.remove(os.path.join(frames_dir, f))
    os.rmdir(frames_dir)
    print(f"Successfully generated {output_path}")

def render_ad_promo_video(output_path):
    print(f"Rendering Commercial Ad Promo to {output_path}...")
    frames_dir = tempfile.mkdtemp()
    num_frames = FPS * 15  # 15 seconds

    for frame_idx in range(num_frames):
        t = frame_idx / float(FPS)
        img = Image.new('RGB', (WIDTH, HEIGHT), color=(9, 13, 22))
        draw = ImageDraw.Draw(img)

        if t < 3.5:
            # Scene 1: High-energy Title & Hook
            draw_canvas_grid(draw, WIDTH, HEIGHT, offset_x=t * 20, offset_y=t * 10)

            badge_w = 460
            bx = (WIDTH - badge_w) // 2
            draw_rounded_rect(draw, [bx, 130, bx + badge_w, 168], 16, fill=(30, 41, 59, 180), outline=(245, 158, 11), width=1)
            draw.text((bx + 30, 142), "⚡ COLLABORATIVE DDD CANVAS + SERVERLESS P2P VIDEO", font=font_xs, fill=(251, 191, 36))

            draw.text((WIDTH // 2 - 280, 200), "Model Complex Software", font=font_hero, fill=(255, 255, 255))
            draw.text((WIDTH // 2 - 220, 260), "At The Speed Of Thought.", font=font_hero, fill=(249, 115, 22))

            draw.text((WIDTH // 2 - 380, 350), "Alberto Brandolini's EventStorming + Serverless P2P Video Calls with Around.co Effects.", font=font_base, fill=(148, 163, 184))

            pills = [
                ("⚡ 0 Sign-in Needed", (59, 130, 246)),
                ("🎙️ Serverless P2P Video Mesh", (16, 185, 129)),
                ("✨ Around Effects & Follow", (236, 72, 153)),
            ]
            for p_idx, (p_text, p_col) in enumerate(pills):
                px = 120 + p_idx * 355
                draw_rounded_rect(draw, [px, 430, px + 325, 475], 10, fill=(15, 23, 42), outline=p_col, width=2)
                draw.text((px + 20, 444), p_text, font=font_sm_bold, fill=(255, 255, 255))

        elif t < 7.5:
            # Scene 2: Live Canvas in Action with P2P Video & Follow Mode
            draw_canvas_grid(draw, WIDTH, HEIGHT)
            is_following = (t >= 5.0)
            draw_header(draw, "Fintech Payment Pipeline Modeling", "Process Modelling", timer_str="14:32", voting_active=True, call_active=True, following_name="Sarah (Product Lead)" if is_following else None)
            draw_sticky_palette(draw)

            # Draw stickies
            draw_sticky_note(img, 280, 180, 'user', 'Cardholder', scale=1.0)
            draw_sticky_note(img, 280, 290, 'command', 'Initiate Checkout', scale=1.0)
            draw_sticky_note(img, 450, 290, 'aggregate', 'Order Aggregate', scale=1.0)
            draw_sticky_note(img, 620, 290, 'event', 'Order Initiated', scale=1.0)
            draw_sticky_note(img, 790, 290, 'policy', 'Whenever Initiated -> Preauth', scale=1.0)
            draw_sticky_note(img, 960, 290, 'hotspot', '3D Secure SMS Latency', votes=7, rotation=-5, scale=1.0)

            # Floating Around Video Call Dock
            draw_videocall_dock(draw, t, show_effects=(5.4 <= t < 7.3))

            # Floating cursor storm with round webcam avatars
            c1_x = 450 + math.sin(t * 3.5) * 140
            c1_y = 260 + math.cos(t * 3.0) * 70
            draw_cursor(draw, c1_x, c1_y, "Sarah (Product Lead)", (249, 115, 22), is_speaking=True, reaction="💡")

            c2_x = c1_x - 120 if is_following else 750 + math.cos(t * 2.8) * 160
            c2_y = c1_y + 40 if is_following else 310 + math.sin(t * 3.2) * 80
            draw_cursor(draw, c2_x, c2_y, "Alex (DO Architect)", (14, 165, 233), aura_color=(34, 211, 238), reaction="👑", is_following=is_following)

            c3_x = 580 + math.sin(t * 2.2) * 170
            c3_y = 440 + math.cos(t * 2.4) * 50
            draw_cursor(draw, c3_x, c3_y, "Elena (Domain Expert)", (168, 85, 247), aura_color=(236, 72, 153), reaction="🌸")

            # Feature badge overlay
            draw_rounded_rect(draw, [280, 480, 780, 545], 12, fill=(15, 23, 42, 230), outline=(99, 102, 241), width=2)
            draw.text((300, 494), "✨ Live WebRTC Mesh + Around.co Webcam Overlays", font=font_base_bold, fill=(255, 255, 255))
            draw.text((300, 518), "Filters (Cyberpunk, Noir) • Glow Auras • 1-Click Follow Mode", font=font_xs, fill=(148, 163, 184))

        elif t < 11.5:
            # Scene 3: P2P Video Call in Action — the hero feature
            draw_canvas_grid(draw, WIDTH, HEIGHT)

            # Big title
            draw.text((WIDTH // 2 - 320, 40), "Serverless P2P Video Calls — Built In", font=font_title, fill=(255, 255, 255))

            # Left side: Large video call simulation with 3 participants
            # Participant 1: Alex (Cyberpunk filter + Crown reaction)
            p1_cx, p1_cy = 220, 280
            draw.ellipse([p1_cx - 55, p1_cy - 55, p1_cx + 55, p1_cy + 55], outline=(34, 211, 238), width=3)
            draw.ellipse([p1_cx - 50, p1_cy - 50, p1_cx + 50, p1_cy + 50], fill=(14, 165, 233))
            draw.text((p1_cx - 15, p1_cy - 10), "AL", font=font_xl, fill=(255, 255, 255))
            draw.text((p1_cx - 12, p1_cy - 72), "👑", font=font_base, fill=(255, 255, 255))
            draw_rounded_rect(draw, [p1_cx - 65, p1_cy + 65, p1_cx + 65, p1_cy + 92], 12, fill=(14, 165, 233), outline=None)
            draw.text((p1_cx - 55, p1_cy + 70), "Alex (Architect)", font=font_xs, fill=(255, 255, 255))
            draw.text((p1_cx - 35, p1_cy + 100), "⚡ Cyberpunk", font=font_xs, fill=(34, 211, 238))

            # Participant 2: Sarah (speaking, pulsing emerald ring)
            p2_cx, p2_cy = 480, 280
            pulse = int(6 * math.sin(t * 8))
            draw.ellipse([p2_cx - 55 - pulse, p2_cy - 55 - pulse, p2_cx + 55 + pulse, p2_cy + 55 + pulse], outline=(52, 211, 153), width=4)
            draw.ellipse([p2_cx - 50, p2_cy - 50, p2_cx + 50, p2_cy + 50], fill=(249, 115, 22))
            draw.text((p2_cx - 15, p2_cy - 10), "SA", font=font_xl, fill=(255, 255, 255))
            draw_rounded_rect(draw, [p2_cx - 70, p2_cy + 65, p2_cx + 70, p2_cy + 92], 12, fill=(5, 150, 105), outline=None)
            draw.text((p2_cx - 62, p2_cy + 70), "Sarah (Product)", font=font_xs, fill=(255, 255, 255))
            draw.text((p2_cx - 38, p2_cy + 100), "🎙️ Speaking...", font=font_xs, fill=(52, 211, 153))

            # Participant 3: Elena (Sunset aura + Pastel filter)
            p3_cx, p3_cy = 740, 280
            draw.ellipse([p3_cx - 55, p3_cy - 55, p3_cx + 55, p3_cy + 55], outline=(251, 191, 36), width=3)
            draw.ellipse([p3_cx - 50, p3_cy - 50, p3_cx + 50, p3_cy + 50], fill=(168, 85, 247))
            draw.text((p3_cx - 15, p3_cy - 10), "EL", font=font_xl, fill=(255, 255, 255))
            draw.text((p3_cx - 12, p3_cy - 72), "🌸", font=font_base, fill=(255, 255, 255))
            draw_rounded_rect(draw, [p3_cx - 65, p3_cy + 65, p3_cx + 65, p3_cy + 92], 12, fill=(168, 85, 247), outline=None)
            draw.text((p3_cx - 58, p3_cy + 70), "Elena (Expert)", font=font_xs, fill=(255, 255, 255))
            draw.text((p3_cx - 35, p3_cy + 100), "🌅 Sunset Glow", font=font_xs, fill=(251, 191, 36))

            # Right side: Feature callouts
            features = [
                ("🎥", "Webcam Bubbles on Cursors", "Live video floats above each peer's cursor", (34, 211, 238)),
                ("✨", "Around.co Cam Effects", "Noir • Cyberpunk • Sunset • Phosphor filters", (236, 72, 153)),
                ("🟢", "Active Speaker Detection", "Pulsing rings highlight who's talking", (52, 211, 153)),
                ("🖥️", "Screen Share PiP", "Share screens in floating windows", (99, 102, 241)),
                ("👁️", "1-Click Follow Mode", "Track facilitators around the canvas", (251, 191, 36)),
                ("🔒", "100% Serverless P2P", "Zero media servers, zero recordings", (244, 63, 94)),
            ]
            for f_idx, (emoji, title, desc, color) in enumerate(features):
                fy = 170 + f_idx * 72
                draw_rounded_rect(draw, [920, fy, 1240, fy + 58], 10, fill=(15, 23, 42), outline=color, width=1)
                draw.text((935, fy + 10), emoji, font=font_base, fill=(255, 255, 255))
                draw.text((965, fy + 8), title, font=font_sm_bold, fill=(255, 255, 255))
                draw.text((965, fy + 30), desc, font=font_xs, fill=(148, 163, 184))

            # Bottom banner
            draw_rounded_rect(draw, [80, 530, 1200, 590], 14, fill=(30, 41, 59, 220), outline=(99, 102, 241), width=2)
            draw.text((120, 548), "🎙️ P2P Video Mesh • Around Effects • Follow Mode • Breakout Isolation • Zero Setup", font=font_base_bold, fill=(255, 255, 255))

        else:
            # Scene 4: Call to Action / Outro
            draw_canvas_grid(draw, WIDTH, HEIGHT)
            draw.text((WIDTH // 2 - 200, 150), "⚡ EventStormer", font=font_hero, fill=(255, 255, 255))
            draw.text((WIDTH // 2 - 310, 230), "Start Storming in Seconds. No Signup Required.", font=font_xl, fill=(249, 115, 22))

            draw_rounded_rect(draw, [WIDTH // 2 - 180, 310, WIDTH // 2 + 180, 380], 14, fill=(249, 115, 22), outline=(255, 255, 255), width=2)
            draw.text((WIDTH // 2 - 140, 332), "Launch Workspace ➔", font=font_xl, fill=(15, 23, 42))

            draw.text((WIDTH // 2 - 340, 430), "✓ P2P Video Calls   ✓ Around Filters & Auras   ✓ Follow Mode   ✓ Breakout Rooms", font=font_base, fill=(148, 163, 184))
            draw.text((WIDTH // 2 - 160, 480), "Zero account needed • Sub-5ms multiplayer", font=font_xs, fill=(100, 116, 139))

        img.save(os.path.join(frames_dir, f"frame_{frame_idx:04d}.png"))

    cmd = [
        'ffmpeg', '-y',
        '-framerate', str(FPS),
        '-i', os.path.join(frames_dir, 'frame_%04d.png'),
        '-f', 'lavfi', '-i', 'aevalsrc=sin(2*PI*t*196)*0.02*exp(-mod(t\\,1.5)*2)+sin(2*PI*t*294)*0.015*exp(-mod(t+0.75\\,1.5)*2):s=44100',
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'fast', '-crf', '22',
        '-c:a', 'aac', '-b:a', '128k', '-shortest',
        output_path
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for f in os.listdir(frames_dir):
        os.remove(os.path.join(frames_dir, f))
    os.rmdir(frames_dir)
    print(f"Successfully generated {output_path}")

if __name__ == '__main__':
    os.makedirs('public/videos', exist_ok=True)
    render_big_picture_video('public/videos/big-picture.mp4')
    render_process_modelling_video('public/videos/process-modelling.mp4')
    render_software_design_video('public/videos/software-design.mp4')
    render_ad_promo_video('public/videos/ad-promo.mp4')
    print("All 4 videos rendered successfully!")
