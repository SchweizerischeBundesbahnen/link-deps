# Contributing

We appreciate all kinds of contributions. The following is a set of guidelines for contributing to this repository on GitHub.
These are mostly guidelines, not rules. Use your best judgment, and feel free to propose changes to this document in a pull request.

#### Table Of Contents

* [Code of Conduct](#code-of-conduct)
* [Feature Requests](#feature)
* [Issues and Bugs](#submit-issue)
* [Pull Requests Guidelines](#submit-pr)

<a id="code-of-conduct"></a>
## Code of Conduct

This project and everyone participating in it is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).
By participating, you are expected to uphold this code.

## <a id="feature"></a> Want a Feature?
You can *request* a new feature by submitting an issue
to our [GitHub Repository](https://github.com/SchweizerischeBundesbahnen/link-deps/issues/new).
If you would like to *implement* a new feature, please submit an issue with
a proposal for your work first, to be sure that we can use it.
Please consider what kind of change it is:

* For a **Major Feature**, first open an issue and outline your proposal so that it can be
  discussed. This will also allow us to better coordinate our efforts, prevent duplication of work,
  and help you to craft the change so that it is successfully accepted into the project.
* **Small Features** can be crafted and directly [submitted as a Pull Request](#submit-pr).


### <a id="submit-issue"></a> Submitting an Issue
If your issue appears to be a bug, and hasn't been reported, open a new issue.
Providing the following information will increase the
chances of your issue being dealt with quickly:

* **Overview of the Issue** - if an error is being thrown a non-minified stack trace helps
* **Toolchain and Environment Details** - which versions of libraries, toolchain, platform etc
* **Motivation for or Use Case** - explain what are you trying to do and why the current behavior
  is a bug for you
* **Related Issues** - has a similar issue been reported before?
* **Suggest a Fix** - if you can't fix the bug yourself, perhaps you can point to what might be
  causing the problem (line of code or commit)

You can file new issues by providing the above information [here](https://github.com/SchweizerischeBundesbahnen/link-deps/issues/new).


### <a id="submit-pr"></a> Submitting a Pull Request (PR)
Before you submit your Pull Request (PR) consider the following guidelines:

* Make your changes in a new git branch:

     ```shell
     git checkout -b my-fix-branch main
     ```

* Create your patch, **including appropriate test cases**.
* Commit your changes using a descriptive commit message.

     ```shell
     git commit -a
     ```
  Note: the optional commit `-a` command line option will automatically "add" and "rm" edited files.

* Push your branch to GitHub:

    ```shell
    git push my-fork my-fix-branch
    ```

* In GitHub, send a pull request to `sbb-your-project:main`.
  The PR title and message should as well conform to the [commit message conventions](#commit).
