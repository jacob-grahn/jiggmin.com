"""Locate an ABC method trait and replace its body with return true."""
import zlib, struct

class Reader:

    def __init__(self, b):
        self.b = b
        self.p = 0

    def u8(self):
        v = self.b[self.p]
        self.p += 1
        return v

    def u30(self):
        v = 0
        for i in range(5):
            c = self.u8()
            v |= (c & 127) << 7 * i
            if c < 128:
                return v

    def skip(self, n):
        self.p += n

def return_true_body(raw, method_name='allowedURL'):
    body = zlib.decompress(raw[8:]) if raw[:3] == b'CWS' else raw[8:]
    p = (5 + 4 * (body[0] >> 3) + 7) // 8 + 4
    while p < len(body):
        h = struct.unpack_from('<H', body, p)[0]
        p += 2
        tag = h >> 6
        n = h & 63
        if n == 63:
            n = struct.unpack_from('<I', body, p)[0]
            p += 4
        if tag == 82:
            a = p + 4
            a = body.index(b'\x00', a) + 1
            r = Reader(body[a:p + n])
            r.skip(4)
            for _ in range(2):
                for i in range(max(0, r.u30() - 1)):
                    r.u30()
            r.skip(max(0, r.u30() - 1) * 8)
            strings = ['']
            for i in range(max(0, r.u30() - 1)):
                l = r.u30()
                strings.append(r.b[r.p:r.p + l].decode(errors='replace'))
                r.skip(l)
            for i in range(max(0, r.u30() - 1)):
                r.u8()
                r.u30()
            for i in range(max(0, r.u30() - 1)):
                for j in range(r.u30()):
                    r.u30()
            names = ['']
            for i in range(max(0, r.u30() - 1)):
                k = r.u8()
                name = ''
                if k in (7, 13):
                    r.u30()
                    name = strings[r.u30()]
                elif k in (9, 14):
                    name = strings[r.u30()]
                    r.u30()
                elif k in (15, 16, 27, 28):
                    r.u30()
                elif k in (17, 18):
                    pass
                elif k == 29:
                    r.u30()
                    for j in range(r.u30()):
                        r.u30()
                else:
                    raise Exception(k)
                names.append(name)
            methods = []
            for i in range(r.u30()):
                count = r.u30()
                r.u30()
                for j in range(count):
                    r.u30()
                name = r.u30()
                flags = r.u8()
                methods.append(strings[name])
                if flags & 8:
                    for j in range(r.u30()):
                        r.u30()
                        r.u8()
                if flags & 128:
                    for j in range(count):
                        r.u30()
            targets = []

            def traits():
                for _ in range(r.u30()):
                    name = names[r.u30()]
                    kind = r.u8()
                    t = kind & 15
                    if t in (0, 6):
                        r.u30()
                        r.u30()
                        v = r.u30()
                        if v:
                            r.u8()
                    elif t in (1, 2, 3):
                        r.u30()
                        method = r.u30()
                        if name == method_name:
                            targets.append(method)
                    elif t in (4, 5):
                        r.u30()
                        r.u30()
                    else:
                        raise ValueError(t)
                    if kind & 64:
                        for _ in range(r.u30()):
                            r.u30()
            for _ in range(r.u30()):
                r.u30()
                count = r.u30()
                for _ in range(count * 2):
                    r.u30()
            classes = r.u30()
            for _ in range(classes):
                r.u30()
                r.u30()
                flags = r.u8()
                if flags & 8:
                    r.u30()
                for _ in range(r.u30()):
                    r.u30()
                r.u30()
                traits()
            for _ in range(classes):
                r.u30()
                traits()
            for _ in range(r.u30()):
                r.u30()
                traits()
            patched = bytearray(body)
            changes = 0
            for _ in range(r.u30()):
                method = r.u30()
                for _ in range(4):
                    r.u30()
                length = r.u30()
                offset = r.p
                if method in targets:
                    assert length >= 2
                    patched[a + offset:a + offset + length] = bytes([38, 72]) + bytes([2]) * (length - 2)
                    changes += 1
                r.skip(length)
                for _ in range(r.u30()):
                    for _ in range(5):
                        r.u30()
                traits()
            if changes != 1:
                raise ValueError((method_name, targets, changes))
            return bytes(patched)
        p += n
    raise ValueError('No matching DoABC block')

def replace_abc_string(body, old, new):
    """Replace one exact ABC string, rebuilding its length and enclosing tag."""
    from swf_button_compat import tags, body_header_length

    def u30(value):
        out = bytearray()
        while value >= 128:
            out.append(value & 127 | 128)
            value >>= 7
        out.append(value)
        return bytes(out)
    start = body_header_length(body)
    result = bytearray(body[:start])
    changes = 0
    for kind, tag, header in tags(body, start):
        if kind == 82:
            abc = tag.index(b'\x00', 4) + 1
            r = Reader(tag)
            r.p = abc + 4
            for _ in range(2):
                for _ in range(max(0, r.u30() - 1)):
                    r.u30()
            r.skip(max(0, r.u30() - 1) * 8)
            spans = []
            for _ in range(max(0, r.u30() - 1)):
                begin = r.p
                length = r.u30()
                if tag[r.p:r.p + length] == old.encode():
                    spans.append((begin, r.p + length))
                r.skip(length)
            for begin, end in reversed(spans):
                encoded = new.encode()
                tag = tag[:begin] + u30(len(encoded)) + encoded + tag[end:]
                changes += 1
            if spans:
                header = struct.pack('<HI', kind << 6 | 63, len(tag))
        result.extend(header)
        result.extend(tag)
    if changes != 1:
        raise ValueError(('Expected one ABC string', old, changes))
    return bytes(result)
