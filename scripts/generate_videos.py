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

def draw_header(draw, title_text, format_name, timer_str="12:45", voting_active=False):
    # Top navbar
    draw.rectangle([0, 0, WIDTH, 54], fill=(15, 23, 42), outline=(30, 41, 59), width=1)
    # Brand logo
    draw.text((20, 16), "⚡ EventStormer", font=font_lg, fill=(255, 255, 255))
    draw_rounded_rect(draw, [180, 17, 275, 37], 10, fill=(245, 158, 11, 40), outline=(245, 158, 11), width=1)
    draw.text((192, 21), "Brandolini DDD", font=font_xs, fill=(251, 191, 36))

    # Workshop Title
    draw.text((310, 18), title_text, font=font_base_bold, fill=(241, 245, 249))

    # Format Badge
    draw_rounded_rect(draw, [550, 17, 710, 37], 10, fill=(30, 58, 138), outline=(59, 130, 246), width=1)
    draw.text((565, 21), format_name, font=font_xs, fill=(147, 197, 253))

    # Timer Pill
    draw_rounded_rect(draw, [730, 17, 825, 37], 10, fill=(20, 83, 45) if not voting_active else (153, 27, 27), outline=(34, 197, 94) if not voting_active else (239, 68, 68), width=1)
    draw.text((742, 21), f"⏱️ {timer_str}", font=font_xs, fill=(240, 253, 244))

    # Voting Mode Badge
    if voting_active:
        draw_rounded_rect(draw, [840, 17, 945, 37], 10, fill=(136, 19, 55), outline=(244, 63, 94), width=1)
        draw.text((852, 21), "🗳️ Dot-Voting", font=font_xs, fill=(255, 228, 230))

    # Peer Avatars
    avatars = [("AL", (14, 165, 233)), ("SA", (249, 115, 22)), ("EL", (168, 85, 247)), ("MK", (34, 197, 94))]
    start_av_x = 970
    for idx, (initials, color) in enumerate(avatars):
        ax = start_av_x + idx * 28
        draw.ellipse([ax, 15, ax + 24, 39], fill=color)
        draw.text((ax + 4, 21), initials, font=font_xs, fill=(255, 255, 255))

    # Actions: Export & Share
    draw_rounded_rect(draw, [1100, 15, 1180, 39], 6, fill=(30, 41, 59), outline=(51, 65, 85), width=1)
    draw.text((1115, 20), "Export", font=font_xs, fill=(226, 232, 240))
    draw_rounded_rect(draw, [1190, 15, 1260, 39], 6, fill=(217, 119, 6), outline=None)
    draw.text((1207, 20), "Share", font=font_xs, fill=(15, 23, 42))

def draw_facilitator_sidebar(draw, active_phase_idx, phases_list):
    # Sidebar container
    draw.rectangle([0, 54, 240, HEIGHT], fill=(11, 17, 32), outline=(30, 41, 59), width=1)
    draw.text((16, 70), "FACILITATOR GUIDE", font=font_xs, fill=(148, 163, 184))

    for idx, (title, desc) in enumerate(phases_list):
        py = 95 + idx * 62
        is_active = (idx == active_phase_idx)
        is_passed = (idx < active_phase_idx)

        bg = (30, 41, 59, 180) if is_active else ((15, 23, 42) if not is_passed else (17, 24, 39))
        border = (99, 102, 241) if is_active else ((51, 65, 85) if not is_passed else (34, 197, 94))
        draw_rounded_rect(draw, [12, py, 228, py + 52], 8, fill=bg, outline=border, width=2 if is_active else 1)

        # Step badge
        step_col = (99, 102, 241) if is_active else ((100, 116, 139) if not is_passed else (34, 197, 94))
        draw.ellipse([20, py + 16, 40, py + 36], fill=step_col)
        badge_text = "✓" if is_passed else str(idx + 1)
        draw.text((27, py + 19), badge_text, font=font_xs, fill=(255, 255, 255))

        # Title & desc
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

    # Temporary image for rotation
    s_img = Image.new('RGBA', (w + 16, h + 16), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(s_img)

    # Shadow
    s_draw.rectangle([6, 6, w + 6, h + 6], fill=(0, 0, 0, 70))
    # Body
    s_draw.rectangle([2, 2, w + 2, h + 2], fill=cfg['bg'], outline=(255, 255, 255, 100), width=1)
    # Type tag
    s_draw.text((8, 6), cfg['label'], font=font_xs, fill=(255, 255, 255, 180))

    # Text wrapping
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

    # Dot votes
    if votes > 0:
        s_draw.ellipse([w - 24, h - 24, w - 4, h - 4], fill=(225, 29, 72))
        s_draw.text((w - 18, h - 22), str(votes), font=font_xs, fill=(255, 255, 255))

    if rotation != 0:
        s_img = s_img.rotate(rotation, resample=Image.BICUBIC, expand=True)

    img.paste(s_img, (int(x), int(y)), s_img)

def draw_cursor(draw, x, y, name, color):
    # Cursor pointer triangle
    points = [(x, y), (x + 14, y + 10), (x + 8, y + 14), (x + 12, y + 22), (x + 7, y + 24), (x + 4, y + 15), (x, y + 18)]
    draw.polygon(points, fill=color, outline=(255, 255, 255))
    # Name tag
    tag_w = len(name) * 7 + 12
    draw_rounded_rect(draw, [x + 14, y + 14, x + 14 + tag_w, y + 32], 4, fill=color)
    draw.text((x + 18, y + 16), name, font=font_xs, fill=(255, 255, 255))

def draw_pivotal_line(draw, x, name):
    for y in range(60, HEIGHT - 60, 10):
        draw.line([(x, y), (x, y + 5)], fill=(239, 68, 68), width=3)
    # Milestone banner
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

        # Swimlanes in stage 4+
        if t >= 8.5:
            lane_prog = min(1.0, (t - 8.5) * 2.0)
            draw_swimlane(draw, 140, 180, "Customer Commerce", (59, 130, 246))
            draw_swimlane(draw, 340, 180, "Logistics & Fulfillment", (16, 185, 129))

        # Pivotal line in stage 2+
        if t >= 3.0:
            draw_pivotal_line(draw, 720, "Pivotal: Order Shipped")

        # Stickies placement & movement
        for e_idx, ev in enumerate(events_data):
            spawn_time = e_idx * 0.4
            if t < spawn_time:
                continue
            if t < 3.0:
                # Chaotic stage
                pop = min(1.0, (t - spawn_time) * 3)
                draw_sticky_note(img, ev['tx'], ev['ty'], 'event', ev['text'], scale=pop)
            else:
                # Timeline alignment interpolation
                move_prog = ease_in_out(min(1.0, (t - 3.0) / 1.5))
                cur_x = ev['tx'] + (ev['fx'] - ev['tx']) * move_prog
                cur_y = ev['ty'] + (ev['fy'] - ev['ty']) * move_prog
                draw_sticky_note(img, cur_x, cur_y, 'event', ev['text'], scale=1.0)

        # Hotspots in stage 3
        if t >= 6.0:
            pop_h = min(1.0, (t - 6.0) * 3)
            votes_1 = min(5, int((t - 6.5) * 3)) if t >= 6.5 else 0
            votes_2 = min(3, int((t - 7.0) * 2)) if t >= 7.0 else 0
            draw_sticky_note(img, 450, 310, 'hotspot', 'Payment Gateway Timeout Spike', votes=votes_1, rotation=-6, scale=pop_h)
            draw_sticky_note(img, 760, 310, 'hotspot', 'Manual Picking Bottleneck', votes=votes_2, rotation=5, scale=pop_h)

        # Users and Systems in stage 4
        if t >= 8.5:
            draw_sticky_note(img, 320, 260, 'user', 'Online Shopper', scale=1.0)
            draw_sticky_note(img, 920, 260, 'system', 'Courier DHL API', scale=1.0)

        # Opportunity sticky in stage 5
        if t >= 10.5:
            draw_sticky_note(img, 580, 520, 'opportunity', 'Automated 1-Click Retry', scale=1.0)

        # Animated cursors
        # Cursor 1: Sarah
        c1_x = 350 + math.sin(t * 1.5) * 180 + t * 25
        c1_y = 220 + math.cos(t * 2.0) * 80
        draw_cursor(draw, c1_x, c1_y, "Sarah (Lead Domain Expert)", (249, 115, 22))

        # Cursor 2: Alex
        c2_x = 750 + math.cos(t * 1.8) * 140
        c2_y = 300 + math.sin(t * 1.4) * 90
        draw_cursor(draw, c2_x, c2_y, "Alex (System Architect)", (14, 165, 233))

        # UI Overlays
        draw_facilitator_sidebar(draw, active_phase, phases)
        timer_str = f"14:{max(0, 50 - int(t * 3)):02d}"
        draw_header(draw, "Global Retail Big Picture Session", "Big Picture", timer_str=timer_str, voting_active=(6.0 <= t < 8.5))
        draw_sticky_palette(draw)

        # Frame save
        img.save(os.path.join(frames_dir, f"frame_{frame_idx:04d}.png"))

    # Encode with FFmpeg + synth audio
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
    # Cleanup frames
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

        # Swimlane for Process Flow
        draw_swimlane(draw, 140, 280, "Order-To-Cash Process Flow", (147, 51, 234))

        # Command-Event-Policy Loop elements
        # 1. User & Command (t >= 1.0)
        if t >= 1.0:
            draw_sticky_note(img, 280, 180, 'user', 'Buyer (Customer)', scale=1.0)
            draw_sticky_note(img, 280, 280, 'command', 'Submit Order', scale=1.0)

        # 2. Aggregate & Event 1 (t >= 2.5)
        if t >= 2.5:
            draw_sticky_note(img, 430, 280, 'aggregate', 'Order Aggregate', scale=1.0)
            draw_sticky_note(img, 580, 280, 'event', 'Order Placed', scale=1.0)
            # Arrow / flow connection
            draw.line([(390, 310), (420, 310)], fill=(99, 102, 241), width=2)
            draw.line([(540, 310), (570, 310)], fill=(234, 88, 12), width=2)

        # 3. Read Model (t >= 5.0)
        if t >= 5.0:
            draw_sticky_note(img, 280, 440, 'readmodel', 'Inventory Catalog View', scale=1.0)
            draw_sticky_note(img, 580, 440, 'readmodel', 'Order Summary Screen', scale=1.0)
            draw.line([(330, 430), (330, 370)], fill=(34, 197, 94), width=2)

        # 4. Policy & Next Command (t >= 7.5)
        if t >= 7.5:
            draw_sticky_note(img, 730, 280, 'policy', 'Whenever Order Placed -> Reserve Stock', scale=1.0)
            draw_sticky_note(img, 880, 280, 'command', 'Reserve Warehouse Items', scale=1.0)
            draw_sticky_note(img, 1030, 280, 'event', 'Stock Allocated', scale=1.0)
            draw.line([(690, 310), (720, 310)], fill=(147, 51, 234), width=2)
            draw.line([(840, 310), (870, 310)], fill=(37, 99, 235), width=2)
            draw.line([(990, 310), (1020, 310)], fill=(234, 88, 12), width=2)

        # 5. Hotspot & Alternative flow (t >= 10.0)
        if t >= 10.0:
            draw_sticky_note(img, 880, 420, 'hotspot', 'Out of Stock Race Condition', votes=4, rotation=5, scale=1.0)
            draw_sticky_note(img, 1030, 420, 'event', 'Stock Reservation Failed', scale=1.0)

        # Cursors
        c1_x = 420 + math.sin(t * 1.6) * 120 + t * 30
        c1_y = 260 + math.cos(t * 2.1) * 60
        draw_cursor(draw, c1_x, c1_y, "Elena (Process Lead)", (168, 85, 247))

        c2_x = 650 + math.cos(t * 1.3) * 160
        c2_y = 340 + math.sin(t * 1.7) * 70
        draw_cursor(draw, c2_x, c2_y, "Marc (Backend Dev)", (34, 197, 94))

        # UI Overlays
        draw_facilitator_sidebar(draw, active_phase, phases)
        timer_str = f"22:{max(0, 45 - int(t * 2)):02d}"
        draw_header(draw, "Order Fulfillment Process Deep Dive", "Process Modelling", timer_str=timer_str, voting_active=(10.0 <= t))
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

        # Swimlanes for Bounded Contexts
        draw_swimlane(draw, 140, 240, "Order Management Bounded Context", (59, 130, 246))
        draw_swimlane(draw, 400, 240, "Billing & Payment Bounded Context", (16, 185, 129))

        # Stage 1: Aggregates
        if t >= 1.0:
            draw_sticky_note(img, 280, 200, 'aggregate', 'Order Aggregate Root', scale=1.0)
            draw_sticky_note(img, 280, 460, 'aggregate', 'Payment Transaction Root', scale=1.0)

        # Stage 2: Invariants
        if t >= 2.5:
            draw_sticky_note(img, 430, 200, 'policy', 'Invariant: Max order items <= 50', scale=1.0)
            draw_sticky_note(img, 430, 460, 'policy', 'Invariant: Currency must match ISO-4217', scale=1.0)

        # Stage 3: Commands & Domain Events
        if t >= 5.0:
            draw_sticky_note(img, 580, 200, 'command', 'CreateOrderCmd', scale=1.0)
            draw_sticky_note(img, 730, 200, 'event', 'OrderCreatedEvt', scale=1.0)
            draw_sticky_note(img, 580, 460, 'command', 'AuthorizeCardCmd', scale=1.0)
            draw_sticky_note(img, 730, 460, 'event', 'CardAuthorizedEvt', scale=1.0)

        # Stage 4: Read Models / Projections
        if t >= 7.5:
            draw_sticky_note(img, 880, 200, 'readmodel', 'ActiveOrdersProjection', scale=1.0)
            draw_sticky_note(img, 880, 460, 'readmodel', 'BillingLedgerView', scale=1.0)

        # Stage 5: Cross-Context Event Integration
        if t >= 10.0:
            draw_sticky_note(img, 1030, 320, 'system', 'Kafka Event Bus Broker', scale=1.0)
            draw.line([(840, 240), (1020, 340)], fill=(234, 88, 12), width=2)
            draw.line([(840, 500), (1020, 380)], fill=(234, 88, 12), width=2)

        # Cursors
        c1_x = 520 + math.cos(t * 1.7) * 140
        c1_y = 230 + math.sin(t * 1.5) * 80
        draw_cursor(draw, c1_x, c1_y, "David (Software Architect)", (14, 165, 233))

        c2_x = 780 + math.sin(t * 1.4) * 110
        c2_y = 380 + math.cos(t * 1.8) * 70
        draw_cursor(draw, c2_x, c2_y, "Sarah (Lead Engineer)", (249, 115, 22))

        # UI Overlays
        draw_facilitator_sidebar(draw, active_phase, phases)
        timer_str = f"18:{max(0, 55 - int(t * 2)):02d}"
        draw_header(draw, "Microservices & Aggregate Boundaries", "Software Design", timer_str=timer_str, voting_active=False)
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
    num_frames = FPS * 14  # 14 seconds

    for frame_idx in range(num_frames):
        t = frame_idx / float(FPS)
        img = Image.new('RGB', (WIDTH, HEIGHT), color=(9, 13, 22))
        draw = ImageDraw.Draw(img)

        if t < 3.2:
            # Scene 1: High-energy Title & Hook
            draw_canvas_grid(draw, WIDTH, HEIGHT, offset_x=t * 20, offset_y=t * 10)

            # Glowing badge
            badge_w = 400
            bx = (WIDTH - badge_w) // 2
            draw_rounded_rect(draw, [bx, 140, bx + badge_w, 175], 16, fill=(30, 41, 59, 180), outline=(245, 158, 11), width=1)
            draw.text((bx + 35, 148), "⚡ THE MODERN DOMAIN DISCOVERY PLATFORM", font=font_xs, fill=(251, 191, 36))

            # Main Hero Headline
            draw.text((WIDTH // 2 - 280, 210), "Model Complex Software", font=font_hero, fill=(255, 255, 255))
            draw.text((WIDTH // 2 - 220, 270), "At The Speed Of Thought.", font=font_hero, fill=(249, 115, 22))

            # Subtitle
            draw.text((WIDTH // 2 - 320, 360), "Alberto Brandolini's EventStorming — Re-engineered for remote engineering teams.", font=font_base, fill=(148, 163, 184))

            # Metric pills
            pills = [
                ("⚡ 0 Sign-in Needed", (59, 130, 246)),
                ("🌐 Cloudflare Durable Objects", (249, 115, 22)),
                ("⏱️ Sub-5ms Realtime Multi-Cursor", (16, 185, 129)),
            ]
            for p_idx, (p_text, p_col) in enumerate(pills):
                px = 180 + p_idx * 320
                draw_rounded_rect(draw, [px, 440, px + 280, 485], 10, fill=(15, 23, 42), outline=p_col, width=2)
                draw.text((px + 20, 454), p_text, font=font_sm_bold, fill=(255, 255, 255))

        elif t < 7.0:
            # Scene 2: Live Canvas in Action
            draw_canvas_grid(draw, WIDTH, HEIGHT)
            draw_header(draw, "Fintech Payment Pipeline Modeling", "Process Modelling", timer_str="14:32", voting_active=True)
            draw_sticky_palette(draw)

            # Draw stickies in live action
            draw_sticky_note(img, 300, 160, 'user', 'Cardholder', scale=1.0)
            draw_sticky_note(img, 300, 280, 'command', 'Initiate Checkout', scale=1.0)
            draw_sticky_note(img, 470, 280, 'aggregate', 'Order Aggregate', scale=1.0)
            draw_sticky_note(img, 640, 280, 'event', 'Order Initiated', scale=1.0)
            draw_sticky_note(img, 810, 280, 'policy', 'Whenever Initiated -> Preauth', scale=1.0)
            draw_sticky_note(img, 980, 280, 'hotspot', '3D Secure SMS Latency', votes=7, rotation=-5, scale=1.0)

            # Floating cursor storm
            c1_x = 450 + math.sin(t * 3.5) * 160
            c1_y = 260 + math.cos(t * 3.0) * 80
            draw_cursor(draw, c1_x, c1_y, "Sarah (Product Lead)", (249, 115, 22))

            c2_x = 750 + math.cos(t * 2.8) * 180
            c2_y = 310 + math.sin(t * 3.2) * 90
            draw_cursor(draw, c2_x, c2_y, "Alex (Cloudflare DO Architect)", (14, 165, 233))

            c3_x = 600 + math.sin(t * 2.2) * 200
            c3_y = 420 + math.cos(t * 2.4) * 60
            draw_cursor(draw, c3_x, c3_y, "Elena (Domain Expert)", (168, 85, 247))

            # Floating highlight callout card
            draw_rounded_rect(draw, [WIDTH // 2 - 250, 490, WIDTH // 2 + 250, 560], 12, fill=(15, 23, 42, 230), outline=(99, 102, 241), width=2)
            draw.text((WIDTH // 2 - 220, 505), "✨ Strict Brandolini Geometries & Syntax", font=font_base_bold, fill=(255, 255, 255))
            draw.text((WIDTH // 2 - 220, 530), "Events • Commands • Aggregates • Policies • Hotspots", font=font_xs, fill=(148, 163, 184))

        elif t < 10.5:
            # Scene 3: The 3 Methodologies Highlighted
            draw_canvas_grid(draw, WIDTH, HEIGHT)
            draw.text((WIDTH // 2 - 260, 80), "Three Methodologies in One Tool", font=font_title, fill=(255, 255, 255))

            cards = [
                ("1. Big Picture", "Explore entire enterprise landscape", "Events • Hotspots • Pivotal Lines", (249, 115, 22)),
                ("2. Process Modelling", "Map end-to-end operational workflows", "Commands • Policies • Read Models", (147, 51, 234)),
                ("3. Software Design", "Architect DDD aggregates & bounded contexts", "Aggregates • Invariants • CQRS", (59, 130, 246)),
            ]
            for c_idx, (c_title, c_desc, c_tags, c_col) in enumerate(cards):
                cx = 120 + c_idx * 360
                draw_rounded_rect(draw, [cx, 160, cx + 320, 480], 16, fill=(15, 23, 42), outline=c_col, width=2)
                draw.rectangle([cx, 160, cx + 320, 175], fill=c_col)
                draw.text((cx + 24, 200), c_title, font=font_xl, fill=(255, 255, 255))
                draw.text((cx + 24, 250), c_desc, font=font_sm, fill=(203, 213, 225))
                draw_rounded_rect(draw, [cx + 20, 310, cx + 300, 370], 8, fill=(30, 41, 59), outline=None)
                draw.text((cx + 30, 332), c_tags, font=font_xs, fill=(251, 191, 36))

                # Little icon / visual badge
                draw_rounded_rect(draw, [cx + 24, 410, cx + 296, 450], 8, fill=(c_col[0], c_col[1], c_col[2], 50), outline=c_col, width=1)
                draw.text((cx + 65, 422), "Built-in Facilitator", font=font_xs, fill=(255, 255, 255))

        else:
            # Scene 4: Call to Action / Outro
            draw_canvas_grid(draw, WIDTH, HEIGHT)
            draw.text((WIDTH // 2 - 200, 160), "⚡ EventStormer", font=font_hero, fill=(255, 255, 255))
            draw.text((WIDTH // 2 - 280, 240), "Start Storming in Seconds. No Signup Required.", font=font_xl, fill=(249, 115, 22))

            # Big CTA button
            draw_rounded_rect(draw, [WIDTH // 2 - 180, 320, WIDTH // 2 + 180, 390], 14, fill=(249, 115, 22), outline=(255, 255, 255), width=2)
            draw.text((WIDTH // 2 - 140, 342), "Launch Workspace ➔", font=font_xl, fill=(15, 23, 42))

            # Trust badges
            draw.text((WIDTH // 2 - 270, 440), "✓ Export to Markdown & Miro   ✓ Dot-Voting   ✓ Facilitator Timers", font=font_base, fill=(148, 163, 184))
            draw.text((WIDTH // 2 - 150, 490), "Built on Cloudflare Workers & Durable Objects", font=font_xs, fill=(100, 116, 139))

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
