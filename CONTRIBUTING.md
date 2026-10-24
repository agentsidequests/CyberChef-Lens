# Contributing to CyberChef Lens

This is the unofficial **agentsidequests/CyberChef-Lens** fork. Changes intended
for Lens should target this repository's **lens** branch.

## Work on Lens

1. Follow the [local quick start](README.md#run-locally), using Git and Node.js 24.
2. Fork [CyberChef Lens](https://github.com/agentsidequests/CyberChef-Lens) and
   create a feature branch from `lens` for your changes.
3. Include tests for changed behavior and invalid-input cases. Keep the original
   license, copyright and third-party notices intact.
4. Run the [build and check sequence](README.md#build-and-check).
5. Open a pull request to **agentsidequests/CyberChef-Lens**, with **lens** as the
   base branch. Explain the problem, the change and the checks you ran.

The coding conventions and design principles below also apply to Lens.

## Contributions to upstream CyberChef

For changes intended for **gchq/CyberChef**, follow
[its contribution guide](https://github.com/gchq/CyberChef/blob/master/CONTRIBUTING.md).
That guide covers upstream's issue tracker, review process and GCHQ Contributor
Licence Agreement. Upstream's project documentation is also preserved in
[UPSTREAM-README.md](UPSTREAM-README.md).

## Coding conventions

* Indentation: Each block should consist of 4 spaces
* Object/namespace identifiers: CamelCase
* Function/variable names: camelCase
* Constants: UNDERSCORE_UPPER_CASE
* Source code encoding: UTF-8 (without BOM)
* All source files must end with a newline
* Line endings: UNIX style (\n)


## Design Principles

1. If at all possible, all operations and features should be client-side and not rely on connections to an external server. This increases the utility of CyberChef on closed networks and in virtual machines that are not connected to the Internet. Calls to external APIs may be accepted if there is no other option, but not for critical components.
2. Latency should be kept to a minimum to enhance the user experience. This means that operation code should sit on the client and be executed there. However, as a trade-off between latency and bandwidth, operation code with large dependencies can be loaded in discrete modules in order to reduce the size of the initial download. The downloading of additional modules must remain entirely transparent so that the user is not inconvenienced.
3. Large libraries should be kept in separate modules so that they are not downloaded by everyone who uses the app, just those who specifically require the relevant operations.
4. Use Vanilla JS if at all possible to reduce the number of libraries required and relied upon. Frameworks like jQuery, although included, should not be used unless absolutely necessary.


With these principles in mind, any changes or additions to CyberChef should keep it:

 - Standalone
 - Efficient
 - As small as possible
