"""Composite saved linear bake passes and verify the actual compositor output."""
import bpy,numpy as np
from pathlib import Path


def pixels(image,size):
    data=np.empty(size*size*4,dtype=np.float32);image.pixels.foreach_get(data)
    return data.reshape(size,size,4)


def compose_trim(directory,size,camera):
    directory=Path(directory)
    # Reopen saved passes: a generated image's compositor cache can otherwise
    # retain the old bake buffer after pixel edits and subsequent bake operators.
    light=bpy.data.images.load(str(directory/'hall-trim-filtered.exr'),check_existing=False)
    albedo=bpy.data.images.load(str(directory/'hall-trim-albedo.exr'),check_existing=False)
    scene=bpy.data.scenes.new('Verified trim composite');scene.render.engine='CYCLES';scene.cycles.samples=1
    scene.collection.objects.link(camera);scene.camera=camera;scene.use_nodes=True
    n=scene.node_tree.nodes;l=scene.node_tree.links;n.clear()
    src=n.new('CompositorNodeImage');src.image=light;col=n.new('CompositorNodeImage');col.image=albedo
    mul=n.new('CompositorNodeMixRGB');mul.blend_type='MULTIPLY';mul.inputs[0].default_value=1
    l.new(src.outputs['Image'],mul.inputs[1]);l.new(col.outputs['Image'],mul.inputs[2])
    linear=n.new('CompositorNodeOutputFile');linear.base_path=str(directory)
    linear.format.file_format='OPEN_EXR';linear.format.color_mode='RGBA';linear.format.color_depth='32'
    linear.file_slots[0].path='hall-trim-composed-';l.new(mul.outputs[0],linear.inputs[0])
    grade=n.new('CompositorNodeHueSat');grade.inputs['Saturation'].default_value=1.2
    l.new(mul.outputs[0],grade.inputs['Image']);sink=n.new('CompositorNodeComposite');l.new(grade.outputs[0],sink.inputs[0])
    scene.view_settings.view_transform='AgX';scene.view_settings.exposure=-1.3
    scene.render.resolution_x=scene.render.resolution_y=size;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB'
    scene.render.filepath=str(directory/'hall-trim.png');bpy.ops.render.render(scene=scene.name,write_still=True)
    actual=bpy.data.images.load(str(directory/'hall-trim-composed-0001.exr'),check_existing=False)
    expected=pixels(light,size)[...,:3]*pixels(albedo,size)[...,:3]
    error=float(np.max(np.abs(pixels(actual,size)[...,:3]-expected)))
    if error>1e-5:raise RuntimeError(f'Compositor output differs from validated lighting × albedo: {error}')
    bpy.data.scenes.remove(scene)
    return error
